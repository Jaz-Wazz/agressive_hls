module.exports =
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
