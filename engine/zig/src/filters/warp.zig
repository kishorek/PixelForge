const std = @import("std");
const core = @import("core");
const pixel = core.pixel;

fn sampleBilinear(
    input: []const u8,
    width: usize,
    height: usize,
    x: f32,
    y: f32,
    channel: usize,
) f32 {
    const clamped_x = std.math.clamp(x, 0, @as(f32, @floatFromInt(width - 1)));
    const clamped_y = std.math.clamp(y, 0, @as(f32, @floatFromInt(height - 1)));
    const x0: usize = @intFromFloat(@floor(clamped_x));
    const y0: usize = @intFromFloat(@floor(clamped_y));
    const x1 = @min(width - 1, x0 + 1);
    const y1 = @min(height - 1, y0 + 1);
    const tx = clamped_x - @as(f32, @floatFromInt(x0));
    const ty = clamped_y - @as(f32, @floatFromInt(y0));

    const top_left = (y0 * width + x0) * 4 + channel;
    const top_right = (y0 * width + x1) * 4 + channel;
    const bottom_left = (y1 * width + x0) * 4 + channel;
    const bottom_right = (y1 * width + x1) * 4 + channel;

    const top = @as(f32, @floatFromInt(input[top_left])) * (1 - tx) +
        @as(f32, @floatFromInt(input[top_right])) * tx;
    const bottom = @as(f32, @floatFromInt(input[bottom_left])) * (1 - tx) +
        @as(f32, @floatFromInt(input[bottom_right])) * tx;
    return top * (1 - ty) + bottom * ty;
}

pub fn warpRgba(
    buffer: []u8,
    scratch: []u8,
    width: usize,
    height: usize,
    perspective: f32,
    distortion: f32,
    background_r: u8,
    background_g: u8,
    background_b: u8,
    has_background: bool,
) pixel.Error!void {
    const expected = try pixel.checkedBufferLen(width, height);
    if (buffer.len != expected) return error.BufferLengthMismatch;
    if (scratch.len < expected) return error.BufferLengthMismatch;
    @memcpy(scratch[0..expected], buffer[0..expected]);

    const p = std.math.clamp(perspective, -100, 100) / 100.0 * 0.5;
    const k = std.math.clamp(distortion, -100, 100) / 100.0 * 0.5;
    const width_f = @as(f32, @floatFromInt(width));
    const height_f = @as(f32, @floatFromInt(height));
    const background = [_]u8{ background_r, background_g, background_b };

    var y: usize = 0;
    while (y < height) : (y += 1) {
        var x: usize = 0;
        while (x < width) : (x += 1) {
            const nx = (@as(f32, @floatFromInt(x)) + 0.5) / width_f - 0.5;
            const ny = (@as(f32, @floatFromInt(y)) + 0.5) / height_f - 0.5;
            const px = nx * (1.0 + p * ny);
            const py = ny;
            const radius_squared = px * px + py * py;
            const factor = 1.0 + k * radius_squared;
            const source_x = (px * factor + 0.5) * width_f - 0.5;
            const source_y = (py * factor + 0.5) * height_f - 0.5;
            const target = (y * width + x) * 4;

            if (source_x < -1 or source_x > width_f or source_y < -1 or source_y > height_f) {
                if (has_background) {
                    buffer[target] = background[0];
                    buffer[target + 1] = background[1];
                    buffer[target + 2] = background[2];
                    buffer[target + 3] = 255;
                } else {
                    buffer[target] = 0;
                    buffer[target + 1] = 0;
                    buffer[target + 2] = 0;
                    buffer[target + 3] = 0;
                }
                continue;
            }

            var channel: usize = 0;
            while (channel < 4) : (channel += 1) {
                const value = sampleBilinear(scratch[0..expected], width, height, source_x, source_y, channel);
                buffer[target + channel] = @intFromFloat(@round(std.math.clamp(value, 0.0, 255.0)));
            }
        }
    }
}
