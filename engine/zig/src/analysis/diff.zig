const core = @import("core");
const pixel = core.pixel;

pub fn diffRgba(
    a: []const u8,
    b: []const u8,
    out: []u8,
    width: usize,
    height: usize,
    amplify: f32,
) pixel.Error!void {
    const expected = try pixel.checkedBufferLen(width, height);
    if (a.len != expected or b.len != expected or out.len != expected) {
        return error.BufferLengthMismatch;
    }
    const scale = if (amplify < 0) 0 else amplify;
    var index: usize = 0;
    while (index < expected) : (index += 4) {
        var channel: usize = 0;
        while (channel < 3) : (channel += 1) {
            const left: i32 = a[index + channel];
            const right: i32 = b[index + channel];
            const delta: f32 = @floatFromInt(@abs(left - right));
            out[index + channel] = @intFromFloat(@min(255.0, delta * scale));
        }
        out[index + 3] = 255;
    }
}
