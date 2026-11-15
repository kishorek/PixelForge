const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });
    const optimize = b.standardOptimizeOption(.{});

    const core_module = b.createModule(.{
        .root_source_file = b.path("src/core/core.zig"),
        .target = target,
        .optimize = optimize,
    });

    const exe = b.addExecutable(.{
        .name = "pixelforge",
        .root_source_file = b.path("src/wasm/exports.zig"),
        .target = target,
        .optimize = optimize,
    });
    exe.root_module.addImport("core", core_module);
    exe.entry = .disabled;
    exe.rdynamic = true;
    b.installArtifact(exe);

    const tests = b.addTest(.{
        .root_source_file = b.path("src/main.zig"),
        .target = b.graph.host,
        .optimize = .Debug,
    });
    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run engine unit tests");
    test_step.dependOn(&run_tests.step);
}
