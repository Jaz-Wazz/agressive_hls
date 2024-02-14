import * as esbuild from "esbuild";
import * as process from "node:process";

const configurations =
{
	"library":
	{
		entryPoints: ["src/agressive_hls.ts", "src/agressive_hls.d.ts"],
		minify: true,
		outdir: "build",
		loader: {".d.ts": "copy"},
		logLevel: "info"
	},
	"examples":
	{
		entryPoints:
		[
			"examples/browser_player/main.html",
			"examples/browser_player/main.css",
			"examples/browser_player/main.ts",
			"examples/buffer_playground/main.html",
			"examples/buffer_playground/main.css",
			"examples/buffer_playground/main.ts"
		],
		bundle: true,
		minify: true,
		sourcemap: true,
		outdir: "build",
		loader: {".html": "copy"},
		logLevel: "info"
	}
};

if(process.argv.includes("--build-library"))
{
	if(process.argv.includes("--only-as-dependency")) if(process.env.INIT_CWD != process.cwd()) process.exit();
	await esbuild.build(configurations.library);
	process.exit();
}

if(process.argv.includes("--build-examples"))
{
	await esbuild.build(configurations.examples);
	process.exit();
}

if(process.argv.includes("--server"))
{
	let ctx = await esbuild.context(configurations.examples);
	await ctx.serve({servedir: "build", port: 8080});
}
