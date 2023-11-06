import webpack from "webpack";

const config: webpack.Configuration =
{
	mode: "development",
	entry: "./src/main.ts",
	module:
	{
		rules:
		[
			{
				test: /\.tsx?$/,
				use: "ts-loader",
				exclude: /node_modules/
			}
		]
	}
};

export default config;
