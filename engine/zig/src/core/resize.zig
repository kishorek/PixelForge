const std = @import("std");
const pixel = @import("pixel.zig");

pub const Method = enum(u32) {
    nearest = 0,
    bilinear = 1,
    box = 2,
};

fn sampleOffset(x: usize, y: usize, width: usize) usize {
    return (y * width + x) * 4;
}

fn resizeNearest(
    input: []const u8,
    output: []u8,
    src_w: usize,
    src_h: usize,
    dst_w: usize,
    dst_h: usize,
) void {
    var y: usize = 0;
    while (y < dst_h) : (y += 1) {
        const sy = @min(src_h - 1, y * src_h / dst_h);
        var x: usize = 0;
        while (x < dst_w) : (x += 1) {
            const sx = @min(src_w - 1, x * src_w / dst_w);
            const source = sampleOffset(sx, sy, src_w);
            const target = sampleOffset(x, y, dst_w);
            @memcpy(output[target .. target + 4], input[source .. source + 4]);
        }
    }
}

fn resizeBilinear(
    input: []const u8,
    output: []u8,
    src_w: usize,
    src_h: usize,
    dst_w: usize,
    dst_h: usize,
) void {
    const src_width_f = @as(f32, @floatFromInt(src_w));
    const src_height_f = @as(f32, @floatFromInt(src_h));
    const dst_width_f = @as(f32, @floatFromInt(dst_w));
    const dst_height_f = @as(f32, @floatFromInt(dst_h));

    var y: usize = 0;
    while (y < dst_h) : (y += 1) {
        const fy = std.math.clamp(
            (@as(f32, @floatFromInt(y)) + 0.5) * src_height_f / dst_height_f - 0.5,
            0.0,
            src_height_f - 1.0,
        );
        const y0: usize = @intFromFloat(@floor(fy));
        const y1 = @min(src_h - 1, y0 + 1);
        const ty = fy - @as(f32, @floatFromInt(y0));

        var x: usize = 0;
        while (x < dst_w) : (x += 1) {
            const fx = std.math.clamp(
                (@as(f32, @floatFromInt(x)) + 0.5) * src_width_f / dst_width_f - 0.5,
                0.0,
                src_width_f - 1.0,
            );
            const x0: usize = @intFromFloat(@floor(fx));
            const x1 = @min(src_w - 1, x0 + 1);
            const tx = fx - @as(f32, @floatFromInt(x0));

            const top_left = sampleOffset(x0, y0, src_w);
            const top_right = sampleOffset(x1, y0, src_w);
            const bottom_left = sampleOffset(x0, y1, src_w);
            const bottom_right = sampleOffset(x1, y1, src_w);
            const target = sampleOffset(x, y, dst_w);

            var channel: usize = 0;
            while (channel < 4) : (channel += 1) {
                const tl = @as(f32, @floatFromInt(input[top_left + channel]));
                const tr = @as(f32, @floatFromInt(input[top_right + channel]));
                const bl = @as(f32, @floatFromInt(input[bottom_left + channel]));
                const br = @as(f32, @floatFromInt(input[bottom_right + channel]));
                const top = tl + (tr - tl) * tx;
                const bottom = bl + (br - bl) * tx;
                const value = top + (bottom - top) * ty;
                output[target + channel] = @intFromFloat(@round(std.math.clamp(value, 0.0, 255.0)));
            }
        }
    }
}

fn resizeBox(
    input: []const u8,
    output: []u8,
    src_w: usize,
    src_h: usize,
    dst_w: usize,
    dst_h: usize,
) void {
    var y: usize = 0;
    while (y < dst_h) : (y += 1) {
        const sy0 = y * src_h / dst_h;
        const sy1 = @min(src_h, @max(sy0 + 1, (y + 1) * src_h / dst_h));
        var x: usize = 0;
        while (x < dst_w) : (x += 1) {
            const sx0 = x * src_w / dst_w;
            const sx1 = @min(src_w, @max(sx0 + 1, (x + 1) * src_w / dst_w));

            var sums = [_]u64{ 0, 0, 0, 0 };
            var count: u64 = 0;
            var sy = sy0;
            while (sy < sy1) : (sy += 1) {
                var sx = sx0;
                while (sx < sx1) : (sx += 1) {
                    const source = sampleOffset(sx, sy, src_w);
                    var channel: usize = 0;
                    while (channel < 4) : (channel += 1) {
                        sums[channel] += input[source + channel];
                    }
                    count += 1;
                }
            }

            const target = sampleOffset(x, y, dst_w);
            var channel: usize = 0;
            while (channel < 4) : (channel += 1) {
                const average = @divTrunc(sums[channel] + count / 2, count);
                output[target + channel] = @intCast(@min(average, 255));
            }
        }
    }
}

pub fn resizeRgba(
    input: []const u8,
    output: []u8,
    src_w: usize,
    src_h: usize,
    dst_w: usize,
    dst_h: usize,
    method: u32,
) pixel.Error!void {
    const expected_input = try pixel.checkedBufferLen(src_w, src_h);
    if (input.len != expected_input) return error.BufferLengthMismatch;
    const expected_output = try pixel.checkedBufferLen(dst_w, dst_h);
    if (output.len != expected_output) return error.BufferLengthMismatch;

    switch (method) {
        0 => resizeNearest(input, output, src_w, src_h, dst_w, dst_h),
        1 => resizeBilinear(input, output, src_w, src_h, dst_w, dst_h),
        2 => resizeBox(input, output, src_w, src_h, dst_w, dst_h),
        else => return error.UnsupportedMethod,
    }
}

const Kernel = enum { lanczos3, catmull_rom };

fn sinc(x: f32) f32 {
    if (x == 0) return 1;
    const px = std.math.pi * x;
    return @sin(px) / px;
}

fn evaluateKernel(kernel: Kernel, x: f32) f32 {
    const absolute = @abs(x);
    return switch (kernel) {
        .lanczos3 => if (absolute >= 3) 0 else sinc(x) * sinc(x / 3),
        .catmull_rom => if (absolute < 1)
            1.5 * absolute * absolute * absolute - 2.5 * absolute * absolute + 1
        else if (absolute < 2)
            -0.5 * absolute * absolute * absolute + 2.5 * absolute * absolute - 4 * absolute + 2
        else
            0,
    };
}

fn kernelRadius(kernel: Kernel) f32 {
    return switch (kernel) {
        .lanczos3 => 3,
        .catmull_rom => 2,
    };
}

fn resampleHorizontal(
    input: []const u8,
    output: []u8,
    src_w: usize,
    src_h: usize,
    dst_w: usize,
    kernel: Kernel,
) void {
    const scale = @as(f32, @floatFromInt(src_w)) / @as(f32, @floatFromInt(dst_w));
    const support = kernelRadius(kernel) * @max(1.0, scale);
    var y: usize = 0;
    while (y < src_h) : (y += 1) {
        var dx: usize = 0;
        while (dx < dst_w) : (dx += 1) {
            const center = (@as(f32, @floatFromInt(dx)) + 0.5) * scale - 0.5;
            const start_f = @max(0.0, center - support);
            const end_f = @min(@as(f32, @floatFromInt(src_w - 1)), center + support);
            var start: usize = @intFromFloat(@ceil(start_f));
            var end: usize = @intFromFloat(@floor(end_f));
            if (start > end) {
                start = @min(src_w - 1, @as(usize, @intFromFloat(@round(center))));
                end = start;
            }
            var sums = [_]f32{ 0, 0, 0, 0 };
            var total: f32 = 0;
            var sx = start;
            while (sx <= end) : (sx += 1) {
                const weight = evaluateKernel(kernel, (@as(f32, @floatFromInt(sx)) - center) / @max(1.0, scale));
                const source = sampleOffset(sx, y, src_w);
                var channel: usize = 0;
                while (channel < 4) : (channel += 1) {
                    sums[channel] += @as(f32, @floatFromInt(input[source + channel])) * weight;
                }
                total += weight;
            }
            const target = sampleOffset(dx, y, dst_w);
            if (@abs(total) < 0.000001) {
                const source = sampleOffset(@min(src_w - 1, @as(usize, @intFromFloat(@round(center)))), y, src_w);
                @memcpy(output[target .. target + 4], input[source .. source + 4]);
            } else {
                var channel: usize = 0;
                while (channel < 4) : (channel += 1) {
                    const value = sums[channel] / total;
                    output[target + channel] = @intFromFloat(@round(std.math.clamp(value, 0.0, 255.0)));
                }
            }
        }
    }
}

fn resampleVertical(
    input: []const u8,
    output: []u8,
    width: usize,
    src_h: usize,
    dst_h: usize,
    kernel: Kernel,
) void {
    const scale = @as(f32, @floatFromInt(src_h)) / @as(f32, @floatFromInt(dst_h));
    const support = kernelRadius(kernel) * @max(1.0, scale);
    var dy: usize = 0;
    while (dy < dst_h) : (dy += 1) {
        const center = (@as(f32, @floatFromInt(dy)) + 0.5) * scale - 0.5;
        const start_f = @max(0.0, center - support);
        const end_f = @min(@as(f32, @floatFromInt(src_h - 1)), center + support);
        var start: usize = @intFromFloat(@ceil(start_f));
        var end: usize = @intFromFloat(@floor(end_f));
        if (start > end) {
            start = @min(src_h - 1, @as(usize, @intFromFloat(@round(center))));
            end = start;
        }
        var x: usize = 0;
        while (x < width) : (x += 1) {
            var sums = [_]f32{ 0, 0, 0, 0 };
            var total: f32 = 0;
            var sy = start;
            while (sy <= end) : (sy += 1) {
                const weight = evaluateKernel(kernel, (@as(f32, @floatFromInt(sy)) - center) / @max(1.0, scale));
                const source = sampleOffset(x, sy, width);
                var channel: usize = 0;
                while (channel < 4) : (channel += 1) {
                    sums[channel] += @as(f32, @floatFromInt(input[source + channel])) * weight;
                }
                total += weight;
            }
            const target = sampleOffset(x, dy, width);
            if (@abs(total) < 0.000001) {
                const source = sampleOffset(x, @min(src_h - 1, @as(usize, @intFromFloat(@round(center)))), width);
                @memcpy(output[target .. target + 4], input[source .. source + 4]);
            } else {
                var channel: usize = 0;
                while (channel < 4) : (channel += 1) {
                    const value = sums[channel] / total;
                    output[target + channel] = @intFromFloat(@round(std.math.clamp(value, 0.0, 255.0)));
                }
            }
        }
    }
}

pub fn resizeRgbaKernel(
    input: []const u8,
    output: []u8,
    scratch: []u8,
    src_w: usize,
    src_h: usize,
    dst_w: usize,
    dst_h: usize,
    method: u32,
) pixel.Error!void {
    const expected_input = try pixel.checkedBufferLen(src_w, src_h);
    if (input.len != expected_input) return error.BufferLengthMismatch;
    const expected_output = try pixel.checkedBufferLen(dst_w, dst_h);
    if (output.len != expected_output) return error.BufferLengthMismatch;
    const scratch_length = dst_w * src_h * 4;
    if (scratch.len < scratch_length) return error.BufferLengthMismatch;

    const kernel: Kernel = switch (method) {
        3 => .lanczos3,
        4 => .catmull_rom,
        else => return error.UnsupportedMethod,
    };
    if (src_w == dst_w and src_h == dst_h) {
        @memcpy(output[0..expected_output], input[0..expected_input]);
        return;
    }

    resampleHorizontal(input, scratch[0..scratch_length], src_w, src_h, dst_w, kernel);
    resampleVertical(scratch[0..scratch_length], output, dst_w, src_h, dst_h, kernel);
}
