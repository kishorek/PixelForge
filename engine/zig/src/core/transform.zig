const pixel = @import("pixel.zig");

fn sampleOffset(x: usize, y: usize, width: usize) usize {
    return (y * width + x) * 4;
}

fn swapPixels(buffer: []u8, a: usize, b: usize) void {
    var temporary: [4]u8 = undefined;
    @memcpy(&temporary, buffer[a .. a + 4]);
    @memcpy(buffer[a .. a + 4], buffer[b .. b + 4]);
    @memcpy(buffer[b .. b + 4], &temporary);
}

pub fn flipRgba(buffer: []u8, width: usize, height: usize, horizontal: bool) pixel.Error!void {
    const expected = try pixel.checkedBufferLen(width, height);
    if (buffer.len != expected) return error.BufferLengthMismatch;

    if (horizontal) {
        var y: usize = 0;
        while (y < height) : (y += 1) {
            var left: usize = 0;
            var right: usize = width - 1;
            while (left < right) {
                const a = sampleOffset(left, y, width);
                const b = sampleOffset(right, y, width);
                swapPixels(buffer, a, b);
                left += 1;
                right -= 1;
            }
        }
    } else {
        var top: usize = 0;
        var bottom: usize = height - 1;
        while (top < bottom) {
            var x: usize = 0;
            while (x < width) : (x += 1) {
                const a = sampleOffset(x, top, width);
                const b = sampleOffset(x, bottom, width);
                swapPixels(buffer, a, b);
            }
            top += 1;
            bottom -= 1;
        }
    }
}

pub fn cropRgba(
    input: []const u8,
    output: []u8,
    src_w: usize,
    src_h: usize,
    x: usize,
    y: usize,
    crop_w: usize,
    crop_h: usize,
) pixel.Error!void {
    const expected_input = try pixel.checkedBufferLen(src_w, src_h);
    if (input.len != expected_input) return error.BufferLengthMismatch;
    const expected_output = try pixel.checkedBufferLen(crop_w, crop_h);
    if (output.len != expected_output) return error.BufferLengthMismatch;

    const right = x + crop_w;
    const bottom = y + crop_h;
    if (right < x or bottom < y or right > src_w or bottom > src_h) return error.OutOfBounds;

    var row: usize = 0;
    while (row < crop_h) : (row += 1) {
        const source = sampleOffset(x, y + row, src_w);
        const target = sampleOffset(0, row, crop_w);
        @memcpy(output[target .. target + crop_w * 4], input[source .. source + crop_w * 4]);
    }
}

pub fn rotate90Rgba(
    input: []const u8,
    output: []u8,
    src_w: usize,
    src_h: usize,
    clockwise: bool,
) pixel.Error!void {
    const expected_input = try pixel.checkedBufferLen(src_w, src_h);
    if (input.len != expected_input) return error.BufferLengthMismatch;
    const expected_output = try pixel.checkedBufferLen(src_h, src_w);
    if (output.len != expected_output) return error.BufferLengthMismatch;

    var y: usize = 0;
    while (y < src_h) : (y += 1) {
        var x: usize = 0;
        while (x < src_w) : (x += 1) {
            const dst_x = if (clockwise) src_h - 1 - y else y;
            const dst_y = if (clockwise) x else src_w - 1 - x;
            const source = sampleOffset(x, y, src_w);
            const target = sampleOffset(dst_x, dst_y, src_h);
            @memcpy(output[target .. target + 4], input[source .. source + 4]);
        }
    }
}
