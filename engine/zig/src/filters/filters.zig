const std = @import("std");
const core = @import("core");
const pixel = core.pixel;

pub const adjustments = @import("adjustments.zig");
pub const chroma = @import("chroma.zig");
pub const warp = @import("warp.zig");

pub const Filter = enum(u32) {
    grayscale = 0,
    sepia = 1,
    invert = 2,
    blur = 3,
    sharpen = 4,
    emboss = 5,
    edge = 6,
    posterize = 7,
    vignette = 8,
};

fn clamp01(value: f32) f32 {
    return std.math.clamp(value, 0.0, 1.0);
}

fn toByte(value: f32) u8 {
    return @intFromFloat(@round(clamp01(value) * 255.0));
}

fn smoothstep(edge0: f32, edge1: f32, value: f32) f32 {
    if (edge0 == edge1) return if (value < edge0) 0.0 else 1.0;
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3.0 - 2.0 * t);
}

fn luma(r: f32, g: f32, b: f32) f32 {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

fn pixelOffset(width: usize, x: usize, y: usize) usize {
    return (y * width + x) * 4;
}

fn boxBlurHorizontal(
    source: []const u8,
    target: []u8,
    width: usize,
    height: usize,
    radius: usize,
) void {
    var y: usize = 0;
    while (y < height) : (y += 1) {
        var channel: usize = 0;
        while (channel < 4) : (channel += 1) {
            var sum: u32 = 0;
            var count: u32 = 0;
            var k: usize = 0;
            while (k <= @min(radius, width - 1)) : (k += 1) {
                sum += source[pixelOffset(width, k, y) + channel];
                count += 1;
            }
            var x: usize = 0;
            while (x < width) : (x += 1) {
                target[pixelOffset(width, x, y) + channel] = @intCast((sum + count / 2) / count);
                const add = x + radius + 1;
                if (add < width) {
                    sum += source[pixelOffset(width, add, y) + channel];
                    count += 1;
                }
                if (x >= radius) {
                    const remove = x - radius;
                    sum -= source[pixelOffset(width, remove, y) + channel];
                    count -= 1;
                }
            }
        }
    }
}

fn boxBlurVertical(
    source: []const u8,
    target: []u8,
    width: usize,
    height: usize,
    radius: usize,
) void {
    var x: usize = 0;
    while (x < width) : (x += 1) {
        var channel: usize = 0;
        while (channel < 4) : (channel += 1) {
            var sum: u32 = 0;
            var count: u32 = 0;
            var k: usize = 0;
            while (k <= @min(radius, height - 1)) : (k += 1) {
                sum += source[pixelOffset(width, x, k) + channel];
                count += 1;
            }
            var y: usize = 0;
            while (y < height) : (y += 1) {
                target[pixelOffset(width, x, y) + channel] = @intCast((sum + count / 2) / count);
                const add = y + radius + 1;
                if (add < height) {
                    sum += source[pixelOffset(width, x, add) + channel];
                    count += 1;
                }
                if (y >= radius) {
                    const remove = y - radius;
                    sum -= source[pixelOffset(width, x, remove) + channel];
                    count -= 1;
                }
            }
        }
    }
}

fn applyBlur(
    buffer: []u8,
    scratch: []u8,
    width: usize,
    height: usize,
    intensity: f32,
) void {
    const shortest = @min(width, height);
    const radius: usize = @max(
        1,
        @min(64, @as(usize, @intFromFloat(@round(intensity * @as(f32, @floatFromInt(shortest)) * 0.02)))),
    );
    const length = width * height * 4;
    @memcpy(scratch[0..length], buffer[0..length]);
    boxBlurHorizontal(scratch[0..length], buffer, width, height, radius);
    boxBlurVertical(buffer[0..length], scratch[0..length], width, height, radius);
    @memcpy(buffer[0..length], scratch[0..length]);
}

fn applyConvolution(
    buffer: []u8,
    scratch: []u8,
    width: usize,
    height: usize,
    kernel: [9]f32,
    offset: f32,
    amount: f32,
) void {
    const length = width * height * 4;
    @memcpy(scratch[0..length], buffer[0..length]);
    var y: usize = 0;
    while (y < height) : (y += 1) {
        var x: usize = 0;
        while (x < width) : (x += 1) {
            var sums = [_]f32{ 0, 0, 0 };
            var ky: usize = 0;
            while (ky < 3) : (ky += 1) {
                const sample_y = if (y + ky == 0) 0 else @min(height - 1, y + ky - 1);
                var kx: usize = 0;
                while (kx < 3) : (kx += 1) {
                    const sample_x = if (x + kx == 0) 0 else @min(width - 1, x + kx - 1);
                    const weight = kernel[ky * 3 + kx];
                    const source = pixelOffset(width, sample_x, sample_y);
                    sums[0] += (@as(f32, @floatFromInt(scratch[source])) / 255.0) * weight;
                    sums[1] += (@as(f32, @floatFromInt(scratch[source + 1])) / 255.0) * weight;
                    sums[2] += (@as(f32, @floatFromInt(scratch[source + 2])) / 255.0) * weight;
                }
            }
            const target = pixelOffset(width, x, y);
            var channel: usize = 0;
            while (channel < 3) : (channel += 1) {
                const original = @as(f32, @floatFromInt(scratch[target + channel])) / 255.0;
                const filtered = clamp01(sums[channel] + offset);
                buffer[target + channel] = toByte(original + (filtered - original) * amount);
            }
        }
    }
}

fn applyEdge(
    buffer: []u8,
    scratch: []u8,
    width: usize,
    height: usize,
    amount: f32,
) void {
    const length = width * height * 4;
    @memcpy(scratch[0..length], buffer[0..length]);
    var y: usize = 0;
    while (y < height) : (y += 1) {
        var x: usize = 0;
        while (x < width) : (x += 1) {
            const left = if (x == 0) 0 else x - 1;
            const right = @min(width - 1, x + 1);
            const top = if (y == 0) 0 else y - 1;
            const bottom = @min(height - 1, y + 1);

            const tl = pixelOffset(width, left, top);
            const tc = pixelOffset(width, x, top);
            const tr = pixelOffset(width, right, top);
            const ml = pixelOffset(width, left, y);
            const mr = pixelOffset(width, right, y);
            const bl = pixelOffset(width, left, bottom);
            const bc = pixelOffset(width, x, bottom);
            const br = pixelOffset(width, right, bottom);

            const gx = -luma(
                @as(f32, @floatFromInt(scratch[tl])) / 255.0,
                @as(f32, @floatFromInt(scratch[tl + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[tl + 2])) / 255.0,
            ) - 2.0 * luma(
                @as(f32, @floatFromInt(scratch[ml])) / 255.0,
                @as(f32, @floatFromInt(scratch[ml + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[ml + 2])) / 255.0,
            ) - luma(
                @as(f32, @floatFromInt(scratch[bl])) / 255.0,
                @as(f32, @floatFromInt(scratch[bl + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[bl + 2])) / 255.0,
            ) + luma(
                @as(f32, @floatFromInt(scratch[tr])) / 255.0,
                @as(f32, @floatFromInt(scratch[tr + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[tr + 2])) / 255.0,
            ) + 2.0 * luma(
                @as(f32, @floatFromInt(scratch[mr])) / 255.0,
                @as(f32, @floatFromInt(scratch[mr + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[mr + 2])) / 255.0,
            ) + luma(
                @as(f32, @floatFromInt(scratch[br])) / 255.0,
                @as(f32, @floatFromInt(scratch[br + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[br + 2])) / 255.0,
            );

            const gy = -luma(
                @as(f32, @floatFromInt(scratch[tl])) / 255.0,
                @as(f32, @floatFromInt(scratch[tl + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[tl + 2])) / 255.0,
            ) - 2.0 * luma(
                @as(f32, @floatFromInt(scratch[tc])) / 255.0,
                @as(f32, @floatFromInt(scratch[tc + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[tc + 2])) / 255.0,
            ) - luma(
                @as(f32, @floatFromInt(scratch[tr])) / 255.0,
                @as(f32, @floatFromInt(scratch[tr + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[tr + 2])) / 255.0,
            ) + luma(
                @as(f32, @floatFromInt(scratch[bl])) / 255.0,
                @as(f32, @floatFromInt(scratch[bl + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[bl + 2])) / 255.0,
            ) + 2.0 * luma(
                @as(f32, @floatFromInt(scratch[bc])) / 255.0,
                @as(f32, @floatFromInt(scratch[bc + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[bc + 2])) / 255.0,
            ) + luma(
                @as(f32, @floatFromInt(scratch[br])) / 255.0,
                @as(f32, @floatFromInt(scratch[br + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[br + 2])) / 255.0,
            );

            const magnitude = clamp01(@sqrt(gx * gx + gy * gy));
            const target = pixelOffset(width, x, y);
            const original = luma(
                @as(f32, @floatFromInt(scratch[target])) / 255.0,
                @as(f32, @floatFromInt(scratch[target + 1])) / 255.0,
                @as(f32, @floatFromInt(scratch[target + 2])) / 255.0,
            );
            const value = toByte(original + (magnitude - original) * amount);
            buffer[target] = value;
            buffer[target + 1] = value;
            buffer[target + 2] = value;
        }
    }
}

pub fn filterRgba(
    buffer: []u8,
    scratch: []u8,
    width: usize,
    height: usize,
    filter: u32,
    intensity: f32,
) pixel.Error!void {
    const expected = try pixel.checkedBufferLen(width, height);
    if (buffer.len != expected) return error.BufferLengthMismatch;
    if (scratch.len < expected) return error.BufferLengthMismatch;
    const amount = clamp01(intensity);
    if (amount <= 0) return;

    switch (filter) {
        0 => {
            var index: usize = 0;
            while (index < buffer.len) : (index += 4) {
                const r = @as(f32, @floatFromInt(buffer[index])) / 255.0;
                const g = @as(f32, @floatFromInt(buffer[index + 1])) / 255.0;
                const b = @as(f32, @floatFromInt(buffer[index + 2])) / 255.0;
                const grey = luma(r, g, b);
                buffer[index] = toByte(r + (grey - r) * amount);
                buffer[index + 1] = toByte(g + (grey - g) * amount);
                buffer[index + 2] = toByte(b + (grey - b) * amount);
            }
        },
        1 => {
            var index: usize = 0;
            while (index < buffer.len) : (index += 4) {
                const r = @as(f32, @floatFromInt(buffer[index])) / 255.0;
                const g = @as(f32, @floatFromInt(buffer[index + 1])) / 255.0;
                const b = @as(f32, @floatFromInt(buffer[index + 2])) / 255.0;
                const sr = 0.393 * r + 0.769 * g + 0.189 * b;
                const sg = 0.349 * r + 0.686 * g + 0.168 * b;
                const sb = 0.272 * r + 0.534 * g + 0.131 * b;
                buffer[index] = toByte(r + (sr - r) * amount);
                buffer[index + 1] = toByte(g + (sg - g) * amount);
                buffer[index + 2] = toByte(b + (sb - b) * amount);
            }
        },
        2 => {
            var index: usize = 0;
            while (index < buffer.len) : (index += 4) {
                var channel: usize = 0;
                while (channel < 3) : (channel += 1) {
                    const value = @as(f32, @floatFromInt(buffer[index + channel])) / 255.0;
                    buffer[index + channel] = toByte(value + ((1.0 - value) - value) * amount);
                }
            }
        },
        3 => applyBlur(buffer, scratch, width, height, amount),
        4 => applyConvolution(
            buffer,
            scratch,
            width,
            height,
            [9]f32{ 0, -1, 0, -1, 5, -1, 0, -1, 0 },
            0,
            amount,
        ),
        5 => applyConvolution(
            buffer,
            scratch,
            width,
            height,
            [9]f32{ -2, -1, 0, -1, 1, 1, 0, 1, 2 },
            0.5,
            amount,
        ),
        6 => applyEdge(buffer, scratch, width, height, amount),
        7 => {
            const levels: f32 = @max(2.0, @round(2.0 + (1.0 - amount) * 30.0));
            const steps = levels - 1.0;
            var index: usize = 0;
            while (index < buffer.len) : (index += 4) {
                var channel: usize = 0;
                while (channel < 3) : (channel += 1) {
                    const value = @as(f32, @floatFromInt(buffer[index + channel])) / 255.0;
                    buffer[index + channel] = toByte(@round(value * steps) / steps);
                }
            }
        },
        8 => {
            const centre_x = @as(f32, @floatFromInt(width - 1)) / 2.0;
            const centre_y = @as(f32, @floatFromInt(height - 1)) / 2.0;
            const radius_x = @max(1.0, @as(f32, @floatFromInt(width)) / 2.0);
            const radius_y = @max(1.0, @as(f32, @floatFromInt(height)) / 2.0);
            var y: usize = 0;
            while (y < height) : (y += 1) {
                var x: usize = 0;
                while (x < width) : (x += 1) {
                    const nx = (@as(f32, @floatFromInt(x)) - centre_x) / radius_x;
                    const ny = (@as(f32, @floatFromInt(y)) - centre_y) / radius_y;
                    const distance = @min(1.0, @sqrt(nx * nx + ny * ny) / 1.41421356);
                    const factor = 1.0 - amount * 0.85 * smoothstep(0.25, 0.95, distance);
                    const target = pixelOffset(width, x, y);
                    var channel: usize = 0;
                    while (channel < 3) : (channel += 1) {
                        buffer[target + channel] = toByte(
                            (@as(f32, @floatFromInt(buffer[target + channel])) / 255.0) * factor,
                        );
                    }
                }
            }
        },
        else => return error.UnsupportedMethod,
    }
}
