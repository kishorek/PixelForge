const std = @import("std");
const pixel = @import("pixel.zig");

pub const bin_count: usize = 256;
pub const channel_count: usize = 4;

/// Writes 4 channels of 256 counts: red, green, blue, luminance.
pub fn histogramRgba(
    input: []const u8,
    width: usize,
    height: usize,
    output: []u32,
) pixel.Error!void {
    const expected = try pixel.checkedBufferLen(width, height);
    if (input.len != expected) return error.BufferLengthMismatch;
    if (output.len != bin_count * channel_count) return error.BufferLengthMismatch;

    @memset(output, 0);
    var index: usize = 0;
    while (index < input.len) : (index += 4) {
        const r = input[index];
        const g = input[index + 1];
        const b = input[index + 2];
        const luma: u8 = @intFromFloat(@round(
            0.2126 * @as(f32, @floatFromInt(r)) +
                0.7152 * @as(f32, @floatFromInt(g)) +
                0.0722 * @as(f32, @floatFromInt(b)),
        ));
        output[r] += 1;
        output[bin_count + g] += 1;
        output[bin_count * 2 + b] += 1;
        output[bin_count * 3 + luma] += 1;
    }
}
