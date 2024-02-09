import * as esbuild from "esbuild";

await esbuild.build(
{
	entryPoints: ["examples/browser_player/main.ts", "examples/buffer_playground/main.ts"],
	outdir: "build",
	bundle: true,
	sourcemap: true
});
