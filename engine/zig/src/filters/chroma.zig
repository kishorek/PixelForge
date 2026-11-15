const std = @import("std");
const core = @import("core");
const pixel = core.pixel;

fn smoothstep(edge0: f32, edge1: f32, value: f32) f32 {
    if (edge0 == edge1) return if (value > edge0) 1.0 else 0.0;
    const t = std.math.clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

pub fn chromaKeyRgba(
    buffer: []u8,
    width: usize,
    height: usize,
    key_r: u8,
    key_g: u8,
    key_b: u8,
    tolerance: f32,
    feather: f32,
    invert: bool,
    background_r: u8,
    background_g: u8,
    background_b: u8,
    has_background: bool,
) pixel.Error!void {
    const expected = try pixel.checkedBufferLen(width, height);
    if (buffer.len != expected) return error.BufferLengthMismatch;

    const threshold = std.math.clamp(tolerance, 0.0, 100.0) / 100.0 * 441.0;
    const band = std.math.clamp(feather, 0.0, 100.0) / 100.0 * 220.0;
    const inner = @max(0.0, threshold - band / 2.0);
    const outer = @min(441.0, threshold + band / 2.0);

    var index: usize = 0;
    while (index < buffer.len) : (index += 4) {
        const r = @as(f32, @floatFromInt(buffer[index]));
        const g = @as(f32, @floatFromInt(buffer[index + 1]));
        const b = @as(f32, @floatFromInt(buffer[index + 2]));
        const dr = r - @as(f32, @floatFromInt(key_r));
        const dg = g - @as(f32, @floatFromInt(key_g));
        const db = b - @as(f32, @floatFromInt(key_b));
        const distance = @sqrt(dr * dr + dg * dg + db * db);
        var mask = 1.0 - smoothstep(inner, outer, distance);
        if (invert) mask = 1.0 - mask;

        if (has_background) {
            const alpha = @as(f32, @floatFromInt(buffer[index + 3]));
            buffer[index] = @intFromFloat(@round(
                @as(f32, @floatFromInt(background_r)) * mask + r * (1.0 - mask),
            ));
            buffer[index + 1] = @intFromFloat(@round(
                @as(f32, @floatFromInt(background_g)) * mask + g * (1.0 - mask),
            ));
            buffer[index + 2] = @intFromFloat(@round(
                @as(f32, @floatFromInt(background_b)) * mask + b * (1.0 - mask),
            ));
            buffer[index + 3] = @intFromFloat(@round(alpha + (255.0 - alpha) * mask));
        } else {
            const alpha = @as(f32, @floatFromInt(buffer[index + 3]));
            buffer[index + 3] = @intFromFloat(@round(alpha * (1.0 - mask)));
        }
    }
}
