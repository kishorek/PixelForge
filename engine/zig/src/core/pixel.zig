const std = @import("std");

pub const max_bytes: usize = 512 * 1024 * 1024;

pub const Error = error{
    InvalidDimensions,
    BufferTooLarge,
    BufferLengthMismatch,
    OutOfBounds,
    UnsupportedMethod,
};

pub const Rgba = struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8,
};

pub fn checkedBufferLen(width: usize, height: usize) Error!usize {
    if (width == 0 or height == 0) return error.InvalidDimensions;
    const pixels = std.math.mul(usize, width, height) catch return error.BufferTooLarge;
    const bytes = std.math.mul(usize, pixels, 4) catch return error.BufferTooLarge;
    if (bytes > max_bytes) return error.BufferTooLarge;
    return bytes;
}

pub fn pixelOffset(width: usize, x: usize, y: usize) Error!usize {
    const row = std.math.mul(usize, y, width) catch return error.OutOfBounds;
    const index = std.math.add(usize, row, x) catch return error.OutOfBounds;
    return std.math.mul(usize, index, 4) catch return error.OutOfBounds;
}
