const std = @import("std");
const core = @import("core");
const pixel = core.pixel;
const resize = core.resize;
const transform = core.transform;

const ERR_OK: u32 = 0;
const ERR_INVALID_ARGUMENT: u32 = 1;
const ERR_BUFFER_TOO_LARGE: u32 = 2;
const ERR_ALLOCATION_FAILED: u32 = 3;
const ERR_UNSUPPORTED: u32 = 4;
const ERR_OUT_OF_BOUNDS: u32 = 5;
const ERR_BUFFER_MISMATCH: u32 = 6;
const ERR_INTERNAL: u32 = 7;

var last_error: u32 = ERR_OK;

const allocator = std.heap.wasm_allocator;

fn fail(code: u32) u32 {
    last_error = code;
    return code;
}

fn succeed() u32 {
    last_error = ERR_OK;
    return ERR_OK;
}

fn codeFor(err: anyerror) u32 {
    return switch (err) {
        error.InvalidDimensions => ERR_INVALID_ARGUMENT,
        error.BufferTooLarge => ERR_BUFFER_TOO_LARGE,
        error.BufferLengthMismatch => ERR_BUFFER_MISMATCH,
        error.OutOfBounds => ERR_OUT_OF_BOUNDS,
        error.UnsupportedMethod => ERR_UNSUPPORTED,
        else => ERR_INTERNAL,
    };
}

export fn pf_abi_version() u32 {
    return 1;
}

export fn pf_last_error() u32 {
    return last_error;
}

export fn pf_alloc(byte_length: usize) ?[*]u8 {
    if (byte_length == 0) return null;
    const buffer = allocator.alloc(u8, byte_length) catch return null;
    return buffer.ptr;
}

export fn pf_free(pointer: ?[*]u8, byte_length: usize) void {
    if (pointer) |ptr| {
        if (byte_length > 0) allocator.free(ptr[0..byte_length]);
    }
}

export fn pf_resize_rgba(
    input_pointer: ?[*]const u8,
    output_pointer: ?[*]u8,
    width: usize,
    height: usize,
    new_width: usize,
    new_height: usize,
    method: u32,
) u32 {
    const input = input_pointer orelse return fail(ERR_INVALID_ARGUMENT);
    const output = output_pointer orelse return fail(ERR_INVALID_ARGUMENT);

    const input_len = pixel.checkedBufferLen(width, height) catch |err| return fail(codeFor(err));
    const output_len = pixel.checkedBufferLen(new_width, new_height) catch |err| return fail(codeFor(err));

    resize.resizeRgba(
        input[0..input_len],
        output[0..output_len],
        width,
        height,
        new_width,
        new_height,
        method,
    ) catch |err| return fail(codeFor(err));

    return succeed();
}

export fn pf_crop_rgba(
    input_pointer: ?[*]const u8,
    output_pointer: ?[*]u8,
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    crop_width: usize,
    crop_height: usize,
) u32 {
    const input = input_pointer orelse return fail(ERR_INVALID_ARGUMENT);
    const output = output_pointer orelse return fail(ERR_INVALID_ARGUMENT);

    const input_len = pixel.checkedBufferLen(width, height) catch |err| return fail(codeFor(err));
    const output_len = pixel.checkedBufferLen(crop_width, crop_height) catch |err| return fail(codeFor(err));

    transform.cropRgba(
        input[0..input_len],
        output[0..output_len],
        width,
        height,
        x,
        y,
        crop_width,
        crop_height,
    ) catch |err| return fail(codeFor(err));

    return succeed();
}

export fn pf_flip_rgba(
    buffer_pointer: ?[*]u8,
    width: usize,
    height: usize,
    horizontal: u32,
) u32 {
    const buffer = buffer_pointer orelse return fail(ERR_INVALID_ARGUMENT);
    const buffer_len = pixel.checkedBufferLen(width, height) catch |err| return fail(codeFor(err));

    transform.flipRgba(buffer[0..buffer_len], width, height, horizontal != 0) catch |err| {
        return fail(codeFor(err));
    };

    return succeed();
}

export fn pf_rotate90_rgba(
    input_pointer: ?[*]const u8,
    output_pointer: ?[*]u8,
    width: usize,
    height: usize,
    clockwise: u32,
) u32 {
    const input = input_pointer orelse return fail(ERR_INVALID_ARGUMENT);
    const output = output_pointer orelse return fail(ERR_INVALID_ARGUMENT);

    const input_len = pixel.checkedBufferLen(width, height) catch |err| return fail(codeFor(err));
    const output_len = pixel.checkedBufferLen(height, width) catch |err| return fail(codeFor(err));

    transform.rotate90Rgba(
        input[0..input_len],
        output[0..output_len],
        width,
        height,
        clockwise != 0,
    ) catch |err| return fail(codeFor(err));

    return succeed();
}
