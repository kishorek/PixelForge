const std = @import("std");
const core = @import("core");
const pixel = core.pixel;

pub const Params = struct {
    brightness: f32 = 0,
    contrast: f32 = 0,
    saturation: f32 = 0,
    temperature: f32 = 0,
    exposure: f32 = 0,
    highlights: f32 = 0,
    shadows: f32 = 0,
    tint: f32 = 0,
    gamma: f32 = 1,
    vibrance: f32 = 0,
};

fn clamp01(value: f32) f32 {
    return std.math.clamp(value, 0.0, 1.0);
}

fn smoothstep(edge0: f32, edge1: f32, value: f32) f32 {
    if (edge0 == edge1) return if (value < edge0) 0.0 else 1.0;
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3.0 - 2.0 * t);
}

fn luma(r: f32, g: f32, b: f32) f32 {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

fn toByte(value: f32) u8 {
    return @intFromFloat(@round(clamp01(value) * 255.0));
}

pub fn adjustRgba(
    buffer: []u8,
    width: usize,
    height: usize,
    params: Params,
) pixel.Error!void {
    const expected = try pixel.checkedBufferLen(width, height);
    if (buffer.len != expected) return error.BufferLengthMismatch;

    const exposure = std.math.pow(f32, 2.0, params.exposure / 100.0);
    const brightness = (params.brightness / 100.0) * 0.5;
    const contrast = 1.0 + params.contrast / 100.0;
    const temperature = (params.temperature / 100.0) * 0.15;
    const tint = (params.tint / 100.0) * 0.15;
    const saturation = 1.0 + params.saturation / 100.0;
    const highlightStrength = (params.highlights / 100.0) * 0.35;
    const shadowStrength = (params.shadows / 100.0) * 0.35;
    const vibrance = params.vibrance / 100.0;
    const inverseGamma = 1.0 / @max(params.gamma, 0.01);

    var index: usize = 0;
    while (index < buffer.len) : (index += 4) {
        var r = @as(f32, @floatFromInt(buffer[index])) / 255.0;
        var g = @as(f32, @floatFromInt(buffer[index + 1])) / 255.0;
        var b = @as(f32, @floatFromInt(buffer[index + 2])) / 255.0;

        r *= exposure;
        g *= exposure;
        b *= exposure;

        r += brightness;
        g += brightness;
        b += brightness;

        r += temperature;
        b -= temperature;
        g -= tint;
        r += tint * 0.5;
        b += tint * 0.5;

        r = (r - 0.5) * contrast + 0.5;
        g = (g - 0.5) * contrast + 0.5;
        b = (b - 0.5) * contrast + 0.5;

        const midLuma = clamp01(luma(r, g, b));
        const highlightDelta = highlightStrength * smoothstep(0.35, 1.0, midLuma);
        const shadowDelta = shadowStrength * (1.0 - smoothstep(0.0, 0.65, midLuma));
        r += highlightDelta + shadowDelta;
        g += highlightDelta + shadowDelta;
        b += highlightDelta + shadowDelta;

        var colourLuma = luma(r, g, b);
        r = colourLuma + (r - colourLuma) * saturation;
        g = colourLuma + (g - colourLuma) * saturation;
        b = colourLuma + (b - colourLuma) * saturation;

        colourLuma = luma(r, g, b);
        const maximum = @max(r, @max(g, b));
        const minimum = @min(r, @min(g, b));
        const currentSaturation = maximum - minimum;
        const vibranceFactor = 1.0 + vibrance * (1.0 - clamp01(currentSaturation));
        r = colourLuma + (r - colourLuma) * vibranceFactor;
        g = colourLuma + (g - colourLuma) * vibranceFactor;
        b = colourLuma + (b - colourLuma) * vibranceFactor;

        r = std.math.pow(f32, clamp01(r), inverseGamma);
        g = std.math.pow(f32, clamp01(g), inverseGamma);
        b = std.math.pow(f32, clamp01(b), inverseGamma);

        buffer[index] = toByte(r);
        buffer[index + 1] = toByte(g);
        buffer[index + 2] = toByte(b);
    }
}
