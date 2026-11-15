const std = @import("std");
const pixel = @import("core/pixel.zig");
const color = @import("core/color.zig");
const resize = @import("core/resize.zig");
const transform = @import("core/transform.zig");

fn approx(expected: f32, actual: f32, tolerance: f32) !void {
    try std.testing.expectApproxEqAbs(expected, actual, tolerance);
}

test "checkedBufferLen returns the RGBA byte length" {
    try std.testing.expectEqual(@as(usize, 16), try pixel.checkedBufferLen(2, 2));
    try std.testing.expectEqual(@as(usize, 4), try pixel.checkedBufferLen(1, 1));
}

test "checkedBufferLen rejects empty dimensions" {
    try std.testing.expectError(error.InvalidDimensions, pixel.checkedBufferLen(0, 2));
    try std.testing.expectError(error.InvalidDimensions, pixel.checkedBufferLen(2, 0));
}

test "checkedBufferLen rejects unreasonable sizes" {
    try std.testing.expectError(error.BufferTooLarge, pixel.checkedBufferLen(100_000, 100_000));
}

test "pixelOffset addresses RGBA channels" {
    try std.testing.expectEqual(@as(usize, 36), try pixel.pixelOffset(4, 1, 2));
    try std.testing.expectEqual(@as(usize, 0), try pixel.pixelOffset(4, 0, 0));
}

test "rgbToHsl converts primary red and neutral grey" {
    const red = color.rgbToHsl(255, 0, 0);
    try approx(0, red.h, 0.001);
    try approx(1, red.s, 0.001);
    try approx(0.5, red.l, 0.001);

    const grey = color.rgbToHsl(128, 128, 128);
    try approx(0, grey.s, 0.001);
    try approx(128.0 / 255.0, grey.l, 0.001);
}

test "hsl round-trips an arbitrary colour" {
    const original = [3]u8{ 33, 200, 120 };
    const hsl = color.rgbToHsl(original[0], original[1], original[2]);
    const rgb = color.hslToRgb(hsl);
    try std.testing.expect(@abs(@as(i16, rgb.r) - @as(i16, original[0])) <= 1);
    try std.testing.expect(@abs(@as(i16, rgb.g) - @as(i16, original[1])) <= 1);
    try std.testing.expect(@abs(@as(i16, rgb.b) - @as(i16, original[2])) <= 1);
}

test "luminance weights green most strongly" {
    try approx(255, color.luminance(255, 255, 255), 0.5);
    try approx(0, color.luminance(0, 0, 0), 0.5);
    try std.testing.expect(color.luminance(0, 255, 0) > color.luminance(255, 0, 0));
}

test "nearest resize preserves a solid colour" {
    const input = [_]u8{ 10, 20, 30, 255, 10, 20, 30, 255, 10, 20, 30, 255, 10, 20, 30, 255 };
    var output: [3 * 3 * 4]u8 = undefined;
    try resize.resizeRgba(&input, &output, 2, 2, 3, 3, 0);
    for (0..9) |i| {
        const offset = i * 4;
        try std.testing.expectEqualSlices(u8, &[_]u8{ 10, 20, 30, 255 }, output[offset .. offset + 4]);
    }
}

test "nearest resize maps output pixels to source pixels" {
    const input = [_]u8{
        1, 0, 0, 255,   2, 0, 0, 255,
        3, 0, 0, 255,   4, 0, 0, 255,
    };
    var output: [4 * 4 * 4]u8 = undefined;
    try resize.resizeRgba(&input, &output, 2, 2, 4, 4, 0);
    try std.testing.expectEqual(@as(u8, 1), output[0]);
    try std.testing.expectEqual(@as(u8, 2), output[2 * 4]);
    try std.testing.expectEqual(@as(u8, 3), output[2 * 16]);
    try std.testing.expectEqual(@as(u8, 4), output[3 * 16 + 12]);
}

test "box resize averages source pixels" {
    const input = [_]u8{
        255, 0, 0, 255,   255, 0, 0, 255,
        0,   0, 255, 255, 0, 0, 255, 255,
    };
    var output: [4]u8 = undefined;
    try resize.resizeRgba(&input, &output, 2, 2, 1, 1, 2);
    try std.testing.expect(@abs(@as(i16, output[0]) - 128) <= 1);
    try std.testing.expectEqual(@as(u8, 0), output[1]);
    try std.testing.expect(@abs(@as(i16, output[2]) - 128) <= 1);
    try std.testing.expectEqual(@as(u8, 255), output[3]);
}

test "resize rejects a short input buffer" {
    const input = [_]u8{ 1, 2, 3, 4 };
    var output: [4]u8 = undefined;
    try std.testing.expectError(error.BufferLengthMismatch, resize.resizeRgba(&input, &output, 2, 2, 1, 1, 0));
}

test "resize rejects an unknown method" {
    const input = [_]u8{0} ** 16;
    var output: [4]u8 = undefined;
    try std.testing.expectError(error.UnsupportedMethod, resize.resizeRgba(&input, &output, 2, 2, 1, 1, 9));
}

test "flip horizontal reverses each row" {
    var buffer = [_]u8{
        1, 0, 0, 255, 2, 0, 0, 255,
        3, 0, 0, 255, 4, 0, 0, 255,
    };
    try transform.flipRgba(&buffer, 2, 2, true);
    try std.testing.expectEqualSlices(u8, &[_]u8{ 2, 0, 0, 255, 1, 0, 0, 255 }, buffer[0..8]);
    try std.testing.expectEqualSlices(u8, &[_]u8{ 4, 0, 0, 255, 3, 0, 0, 255 }, buffer[8..16]);
}

test "flip vertical reverses rows" {
    var buffer = [_]u8{
        1, 0, 0, 255, 2, 0, 0, 255,
        3, 0, 0, 255, 4, 0, 0, 255,
    };
    try transform.flipRgba(&buffer, 2, 2, false);
    try std.testing.expectEqualSlices(u8, &[_]u8{ 3, 0, 0, 255, 4, 0, 0, 255 }, buffer[0..8]);
    try std.testing.expectEqualSlices(u8, &[_]u8{ 1, 0, 0, 255, 2, 0, 0, 255 }, buffer[8..16]);
}

test "crop extracts a sub-rectangle" {
    const input = [_]u8{
        1,  0, 0, 255, 2,  0, 0, 255, 3,  0, 0, 255,
        4,  0, 0, 255, 5,  0, 0, 255, 6,  0, 0, 255,
        7,  0, 0, 255, 8,  0, 0, 255, 9,  0, 0, 255,
    };
    var output: [2 * 2 * 4]u8 = undefined;
    try transform.cropRgba(&input, &output, 3, 3, 1, 1, 2, 2);
    try std.testing.expectEqual(@as(u8, 5), output[0]);
    try std.testing.expectEqual(@as(u8, 6), output[4]);
    try std.testing.expectEqual(@as(u8, 8), output[8]);
    try std.testing.expectEqual(@as(u8, 9), output[12]);
}

test "crop rejects an out-of-bounds rectangle" {
    const input = [_]u8{0} ** (3 * 3 * 4);
    var output: [2 * 2 * 4]u8 = undefined;
    try std.testing.expectError(error.OutOfBounds, transform.cropRgba(&input, &output, 3, 3, 2, 2, 2, 2));
}

test "rotate90 clockwise moves corners and swaps dimensions" {
    const input = [_]u8{
        1, 0, 0, 255, 2, 0, 0, 255,
        3, 0, 0, 255, 4, 0, 0, 255,
        5, 0, 0, 255, 6, 0, 0, 255,
    };
    var output: [2 * 3 * 4]u8 = undefined;
    try transform.rotate90Rgba(&input, &output, 2, 3, true);
    try std.testing.expectEqual(@as(u8, 5), output[0]);
    try std.testing.expectEqual(@as(u8, 3), output[4]);
    try std.testing.expectEqual(@as(u8, 1), output[8]);
    try std.testing.expectEqual(@as(u8, 6), output[12]);
    try std.testing.expectEqual(@as(u8, 4), output[16]);
    try std.testing.expectEqual(@as(u8, 2), output[20]);
}

test "rotate90 four times is the identity" {
    const input = [_]u8{
        1, 10, 100, 255, 2, 20, 200, 255,
        3, 30, 210, 255, 4, 40, 220, 255,
        5, 50, 230, 255, 6, 60, 240, 255,
    };
    var first: [2 * 3 * 4]u8 = undefined;
    try transform.rotate90Rgba(&input, &first, 2, 3, true);
    var second: [3 * 2 * 4]u8 = undefined;
    try transform.rotate90Rgba(&first, &second, 3, 2, true);
    var third: [2 * 3 * 4]u8 = undefined;
    try transform.rotate90Rgba(&second, &third, 2, 3, true);
    var fourth: [3 * 2 * 4]u8 = undefined;
    try transform.rotate90Rgba(&third, &fourth, 3, 2, true);
    try std.testing.expectEqualSlices(u8, &input, &fourth);
}
