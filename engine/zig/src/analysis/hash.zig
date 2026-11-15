const std = @import("std");
const core = @import("core");
const pixel = core.pixel;

fn luma(red: u8, green: u8, blue: u8) f32 {
    return 0.2126 * @as(f32, @floatFromInt(red)) +
        0.7152 * @as(f32, @floatFromInt(green)) +
        0.0722 * @as(f32, @floatFromInt(blue));
}

fn cellLuminance(
    input: []const u8,
    width: usize,
    height: usize,
    cell_x: usize,
    cell_y: usize,
    columns: usize,
    rows: usize,
) f32 {
    const x0 = @min(width - 1, cell_x * width / columns);
    const x1 = @max(x0 + 1, @min(width, (cell_x + 1) * width / columns));
    const y0 = @min(height - 1, cell_y * height / rows);
    const y1 = @max(y0 + 1, @min(height, (cell_y + 1) * height / rows));
    var total: f32 = 0;
    var count: usize = 0;
    var y = y0;
    while (y < y1) : (y += 1) {
        var x = x0;
        while (x < x1) : (x += 1) {
            const offset = (y * width + x) * 4;
            total += luma(input[offset], input[offset + 1], input[offset + 2]);
            count += 1;
        }
    }
    return if (count > 0) total / @as(f32, @floatFromInt(count)) else 0;
}

/// Writes average-hash (lo, hi) and difference-hash (lo, hi) into output.
pub fn perceptualHashRgba(
    input: []const u8,
    width: usize,
    height: usize,
    output: []u32,
) pixel.Error!void {
    const expected = try pixel.checkedBufferLen(width, height);
    if (input.len != expected) return error.BufferLengthMismatch;
    if (output.len < 4) return error.BufferLengthMismatch;
    output[0] = 0;
    output[1] = 0;
    output[2] = 0;
    output[3] = 0;
    if (width < 9 or height < 9) return;

    var average_cells: [64]f32 = undefined;
    var average_total: f32 = 0;
    var cy: usize = 0;
    while (cy < 8) : (cy += 1) {
        var cx: usize = 0;
        while (cx < 8) : (cx += 1) {
            const value = cellLuminance(input, width, height, cx, cy, 8, 8);
            average_cells[cy * 8 + cx] = value;
            average_total += value;
        }
    }
    const overall = average_total / 64.0;
    var a_lo: u32 = 0;
    var a_hi: u32 = 0;
    var index: usize = 0;
    while (index < 64) : (index += 1) {
        if (average_cells[index] > overall) {
            if (index < 32) {
                a_lo |= @as(u32, 1) << @intCast(index);
            } else {
                a_hi |= @as(u32, 1) << @intCast(index - 32);
            }
        }
    }
    output[0] = a_lo;
    output[1] = a_hi;

    var difference_cells: [72]f32 = undefined;
    cy = 0;
    while (cy < 8) : (cy += 1) {
        var cx: usize = 0;
        while (cx < 9) : (cx += 1) {
            difference_cells[cy * 9 + cx] = cellLuminance(input, width, height, cx, cy, 9, 8);
        }
    }
    var d_lo: u32 = 0;
    var d_hi: u32 = 0;
    cy = 0;
    while (cy < 8) : (cy += 1) {
        var cx: usize = 0;
        while (cx < 8) : (cx += 1) {
            const bit = difference_cells[cy * 9 + cx] > difference_cells[cy * 9 + cx + 1];
            const bit_index = cy * 8 + cx;
            if (bit) {
                if (bit_index < 32) {
                    d_lo |= @as(u32, 1) << @intCast(bit_index);
                } else {
                    d_hi |= @as(u32, 1) << @intCast(bit_index - 32);
                }
            }
        }
    }
    output[2] = d_lo;
    output[3] = d_hi;
}
