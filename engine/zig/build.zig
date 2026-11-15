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
    const filters_module = b.createModule(.{
        .root_source_file = b.path("src/filters/filters.zig"),
        .target = target,
        .optimize = optimize,
    });
    filters_module.addImport("core", core_module);
    const analysis_module = b.createModule(.{
        .root_source_file = b.path("src/analysis/analysis.zig"),
        .target = target,
        .optimize = optimize,
    });
    analysis_module.addImport("core", core_module);

    const exe = b.addExecutable(.{
        .name = "pixelforge",
        .root_source_file = b.path("src/wasm/exports.zig"),
        .target = target,
        .optimize = optimize,
    });
    exe.root_module.addImport("core", core_module);
    exe.root_module.addImport("filters", filters_module);
    exe.root_module.addImport("analysis", analysis_module);
    exe.entry = .disabled;
    exe.rdynamic = true;
    b.installArtifact(exe);

    const test_core_module = b.createModule(.{
        .root_source_file = b.path("src/core/core.zig"),
        .target = b.graph.host,
        .optimize = .Debug,
    });
    const test_filters_module = b.createModule(.{
        .root_source_file = b.path("src/filters/filters.zig"),
        .target = b.graph.host,
        .optimize = .Debug,
    });
    test_filters_module.addImport("core", test_core_module);
    const test_analysis_module = b.createModule(.{
        .root_source_file = b.path("src/analysis/analysis.zig"),
        .target = b.graph.host,
        .optimize = .Debug,
    });
    test_analysis_module.addImport("core", test_core_module);

    const tests = b.addTest(.{
        .root_source_file = b.path("src/main.zig"),
        .target = b.graph.host,
        .optimize = .Debug,
    });
    tests.root_module.addImport("core", test_core_module);
    tests.root_module.addImport("filters", test_filters_module);
    tests.root_module.addImport("analysis", test_analysis_module);

    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run engine unit tests");
    test_step.dependOn(&run_tests.step);
}
