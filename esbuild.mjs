import * as esbuild from "esbuild";

let opts =
{
	entryPoints: ["examples/browser_player/main.ts", "examples/buffer_playground/main.ts"],
	outdir: "build",
	bundle: true,
	sourcemap: true
};

if(process.argv[2] == "--build")
{
	await esbuild.build(opts);
}

if(process.argv[2] == "--server")
{
	let ctx = await esbuild.context(opts);
	await ctx.serve({servedir: "build"});
}
