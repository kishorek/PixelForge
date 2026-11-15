const std = @import("std");
const core = @import("core");
const filters = @import("filters");
const analysis = @import("analysis");
const pixel = core.pixel;
const color = core.color;
const resize = core.resize;
const transform = core.transform;
const histogram = core.histogram;
const adjustments = filters.adjustments;
const imageFilters = filters;
const imageDiff = analysis.diff;
const imageHash = analysis.hash;

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

test "histogram counts red, green, blue and luminance" {
    const input = [_]u8{
        255, 0,   0,   255,
        0,   0,   0,   255,
    };
    var counts: [4 * 256]u32 = undefined;
    try histogram.histogramRgba(&input, 2, 1, &counts);
    try std.testing.expectEqual(@as(u32, 1), counts[255]);
    try std.testing.expectEqual(@as(u32, 2), counts[256]);
    try std.testing.expectEqual(@as(u32, 2), counts[512]);
    try std.testing.expectEqual(@as(u32, 1), counts[768 + 0]);
    try std.testing.expectEqual(@as(u32, 1), counts[768 + 54]);
}

test "adjustments preserve pixels with identity parameters" {
    var buffer = [_]u8{
        10,  20,  30,  255,
        200, 100, 50,  128,
    };
    const original = buffer;
    try adjustments.adjustRgba(&buffer, 2, 1, .{});
    for (0..buffer.len) |index| {
        const expected: i16 = original[index];
        const actual: i16 = buffer[index];
        try std.testing.expect(@abs(expected - actual) <= 1);
    }
}

test "brightness raises and saturation removes colour" {
    var bright = [_]u8{ 100, 100, 100, 255 };
    try adjustments.adjustRgba(&bright, 1, 1, .{ .brightness = 50 });
    try std.testing.expect(bright[0] > 150);
    try std.testing.expectEqual(@as(u8, 255), bright[3]);

    var grey = [_]u8{ 255, 0, 0, 255 };
    try adjustments.adjustRgba(&grey, 1, 1, .{ .saturation = -100 });
    try std.testing.expectEqual(grey[0], grey[1]);
    try std.testing.expectEqual(grey[1], grey[2]);
}

test "gamma and contrast adjust tonal response" {
    var gamma = [_]u8{ 128, 128, 128, 255 };
    try adjustments.adjustRgba(&gamma, 1, 1, .{ .gamma = 2.0 });
    try std.testing.expect(gamma[0] > 128);

    var flat = [_]u8{ 20, 220, 90, 255 };
    try adjustments.adjustRgba(&flat, 1, 1, .{ .contrast = -100 });
    try std.testing.expectEqual(@as(u8, 128), flat[0]);
    try std.testing.expectEqual(@as(u8, 128), flat[1]);
    try std.testing.expectEqual(@as(u8, 128), flat[2]);
}

test "grayscale filter equalises channels" {
    var buffer = [_]u8{ 255, 0, 0, 255 };
    var scratch: [4]u8 = undefined;
    try imageFilters.filterRgba(&buffer, &scratch, 1, 1, 0, 1.0);
    try std.testing.expectEqual(buffer[0], buffer[1]);
    try std.testing.expectEqual(buffer[1], buffer[2]);
    try std.testing.expect(buffer[0] > 50);
}

test "invert filter reverses channels" {
    var buffer = [_]u8{ 255, 0, 0, 128 };
    var scratch: [4]u8 = undefined;
    try imageFilters.filterRgba(&buffer, &scratch, 1, 1, 2, 1.0);
    try std.testing.expectEqual(@as(u8, 0), buffer[0]);
    try std.testing.expectEqual(@as(u8, 255), buffer[1]);
    try std.testing.expectEqual(@as(u8, 128), buffer[3]);
}

test "blur preserves a solid image" {
    var buffer = [_]u8{
        40, 80, 120, 255, 40, 80, 120, 255, 40, 80, 120, 255,
        40, 80, 120, 255, 40, 80, 120, 255, 40, 80, 120, 255,
        40, 80, 120, 255, 40, 80, 120, 255, 40, 80, 120, 255,
    };
    var scratch: [36]u8 = undefined;
    try imageFilters.filterRgba(&buffer, &scratch, 3, 3, 3, 1.0);
    for (0..9) |index| {
        const offset = index * 4;
        try std.testing.expectEqualSlices(u8, &[_]u8{ 40, 80, 120, 255 }, buffer[offset .. offset + 4]);
    }
}

test "posterize and vignette change tone" {
    var poster = [_]u8{ 100, 100, 100, 255 };
    var scratch: [4]u8 = undefined;
    try imageFilters.filterRgba(&poster, &scratch, 1, 1, 7, 1.0);
    try std.testing.expectEqual(@as(u8, 0), poster[0]);

    var vignette = [_]u8{
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
        255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    };
    var vignette_scratch: [36]u8 = undefined;
    try imageFilters.filterRgba(&vignette, &vignette_scratch, 3, 3, 8, 1.0);
    try std.testing.expect(vignette[0] < 255);
    try std.testing.expectEqual(@as(u8, 255), vignette[16]);
}


test "diff identifies changed channels" {
    const a = [_]u8{ 255, 0, 0, 255 };
    const b = [_]u8{ 0, 0, 0, 255 };
    var output: [4]u8 = undefined;
    try imageDiff.diffRgba(&a, &b, &output, 1, 1, 1.0);
    try std.testing.expectEqual(@as(u8, 255), output[0]);
    try std.testing.expectEqual(@as(u8, 0), output[1]);
    try std.testing.expectEqual(@as(u8, 255), output[3]);
}

test "perceptual hash is zero for a uniform image and differs for a split image" {
    var uniform: [9 * 9 * 4]u8 = [_]u8{ 80, 80, 80, 255 } ** (9 * 9);
    var uniform_hash: [4]u32 = undefined;
    try imageHash.perceptualHashRgba(&uniform, 9, 9, &uniform_hash);
    try std.testing.expectEqual(@as(u32, 0), uniform_hash[0]);
    try std.testing.expectEqual(@as(u32, 0), uniform_hash[1]);

    var split: [16 * 16 * 4]u8 = undefined;
    var y: usize = 0;
    while (y < 16) : (y += 1) {
        var x: usize = 0;
        while (x < 16) : (x += 1) {
            const value: u8 = if (x < 8) 0 else 255;
            const offset = (y * 16 + x) * 4;
            split[offset] = value;
            split[offset + 1] = value;
            split[offset + 2] = value;
            split[offset + 3] = 255;
        }
    }
    var split_hash: [4]u32 = undefined;
    try imageHash.perceptualHashRgba(&split, 16, 16, &split_hash);
    try std.testing.expect(split_hash[0] != 0 or split_hash[1] != 0);
}

test "advanced resamplers preserve a solid image" {
    const input = [_]u8{ 40, 80, 120, 255 } ** 4;
    var lanczos_output: [9 * 4]u8 = undefined;
    var lanczos_scratch: [3 * 2 * 4]u8 = undefined;
    try resize.resizeRgbaKernel(&input, &lanczos_output, &lanczos_scratch, 2, 2, 3, 3, 3);
    for (0..9) |index| {
        const offset = index * 4;
        try std.testing.expect(@abs(@as(i16, lanczos_output[offset]) - 40) <= 1);
        try std.testing.expect(@abs(@as(i16, lanczos_output[offset + 1]) - 80) <= 1);
        try std.testing.expect(@abs(@as(i16, lanczos_output[offset + 2]) - 120) <= 1);
        try std.testing.expectEqual(@as(u8, 255), lanczos_output[offset + 3]);
    }

    var catmull_output: [9 * 4]u8 = undefined;
    var catmull_scratch: [3 * 2 * 4]u8 = undefined;
    try resize.resizeRgbaKernel(&input, &catmull_output, &catmull_scratch, 2, 2, 3, 3, 4);
    try std.testing.expect(@abs(@as(i16, catmull_output[0]) - 40) <= 1);
}

test "advanced resampler copies identical dimensions and rejects unknown methods" {
    const input = [_]u8{ 1, 2, 3, 4, 5, 6, 7, 8 };
    var output: [8]u8 = undefined;
    var scratch: [8]u8 = undefined;
    try resize.resizeRgbaKernel(&input, &output, &scratch, 2, 1, 2, 1, 3);
    try std.testing.expectEqualSlices(u8, &input, &output);
    try std.testing.expectError(error.UnsupportedMethod, resize.resizeRgbaKernel(&input, &output, &scratch, 2, 1, 2, 1, 9));
}


test "chroma key removes the selected colour" {
    var buffer = [_]u8{
        255, 0,   0, 255,
        0,   0, 255, 255,
    };
    try imageFilters.chroma.chromaKeyRgba(&buffer, 2, 1, 255, 0, 0, 0, 0, false, 0, 0, 0, false);
    try std.testing.expectEqual(@as(u8, 0), buffer[3]);
    try std.testing.expectEqual(@as(u8, 255), buffer[7]);
}

test "chroma key replaces with a background or inverts" {
    var buffer = [_]u8{ 255, 0, 0, 128 };
    try imageFilters.chroma.chromaKeyRgba(&buffer, 1, 1, 255, 0, 0, 0, 0, false, 0, 0, 0, true);
    try std.testing.expectEqualSlices(u8, &[_]u8{ 0, 0, 0, 255 }, &buffer);

    var inverted = [_]u8{ 255, 0, 0, 255, 0, 0, 255, 255 };
    try imageFilters.chroma.chromaKeyRgba(&inverted, 2, 1, 255, 0, 0, 0, 0, true, 0, 0, 0, false);
    try std.testing.expectEqual(@as(u8, 255), inverted[3]);
    try std.testing.expectEqual(@as(u8, 0), inverted[7]);
}


test "warp identity copies pixels" {
    var buffer = [_]u8{ 10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255 };
    const original = buffer;
    var scratch: [16]u8 = undefined;
    try imageFilters.warp.warpRgba(&buffer, &scratch, 2, 2, 0, 0, 0, 0, 0, false);
    try std.testing.expectEqualSlices(u8, &original, &buffer);
}

test "warp perspective can push corners outside the source" {
    var buffer: [16 * 16 * 4]u8 = [_]u8{ 50, 60, 70, 255 } ** (16 * 16);
    var scratch: [16 * 16 * 4]u8 = undefined;
    try imageFilters.warp.warpRgba(&buffer, &scratch, 16, 16, 100, 0, 0, 0, 0, false);
    const bottom_left = (15 * 16 + 0) * 4;
    try std.testing.expectEqual(@as(u8, 0), buffer[bottom_left + 3]);
}
