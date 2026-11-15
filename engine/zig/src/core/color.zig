const std = @import("std");

pub const Rgb = struct {
    r: u8,
    g: u8,
    b: u8,
};

pub const Hsl = struct {
    h: f32,
    s: f32,
    l: f32,
};

fn toUnit(value: u8) f32 {
    return @as(f32, @floatFromInt(value)) / 255.0;
}

fn toByte(value: f32) u8 {
    const clamped = std.math.clamp(value, 0.0, 1.0);
    return @intFromFloat(@round(clamped * 255.0));
}

fn hueToChannel(p: f32, q: f32, t_in: f32) f32 {
    var t = t_in;
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0 / 2.0) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
}

pub fn rgbToHsl(r: u8, g: u8, b: u8) Hsl {
    const rf = toUnit(r);
    const gf = toUnit(g);
    const bf = toUnit(b);
    const max = @max(rf, @max(gf, bf));
    const min = @min(rf, @min(gf, bf));
    const l = (max + min) / 2.0;
    var h: f32 = 0;
    var s: f32 = 0;

    if (max != min) {
        const delta = max - min;
        s = if (l > 0.5) delta / (2.0 - max - min) else delta / (max + min);
        if (max == rf) {
            h = (gf - bf) / delta + (if (gf < bf) @as(f32, 6.0) else 0.0);
        } else if (max == gf) {
            h = (bf - rf) / delta + 2.0;
        } else {
            h = (rf - gf) / delta + 4.0;
        }
        h *= 60.0;
    }

    return .{ .h = h, .s = s, .l = l };
}

pub fn hslToRgb(hsl: Hsl) Rgb {
    var hue = hsl.h / 360.0;
    hue -= @floor(hue);
    const s = std.math.clamp(hsl.s, 0.0, 1.0);
    const l = std.math.clamp(hsl.l, 0.0, 1.0);

    if (s == 0.0) {
        const grey = toByte(l);
        return .{ .r = grey, .g = grey, .b = grey };
    }

    const q = if (l < 0.5) l * (1.0 + s) else l + s - l * s;
    const p = 2.0 * l - q;
    return .{
        .r = toByte(hueToChannel(p, q, hue + 1.0 / 3.0)),
        .g = toByte(hueToChannel(p, q, hue)),
        .b = toByte(hueToChannel(p, q, hue - 1.0 / 3.0)),
    };
}

pub fn luminance(r: u8, g: u8, b: u8) f32 {
    return 0.2126 * toUnit(r) * 255.0 +
        0.7152 * toUnit(g) * 255.0 +
        0.0722 * toUnit(b) * 255.0;
}
