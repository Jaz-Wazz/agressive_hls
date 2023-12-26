import Hls, { FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";

export class CustomLoader extends (<new (confg: HlsConfig) => Loader<FragmentLoaderContext>> Hls.DefaultConfig.loader)
{
	constructor(config: HlsConfig)
	{
		super(config);
		console.log("construct");
	}

	async load(context: FragmentLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>)
	{
		console.log("load");
		let response = await fetch(context.url);
		let buffer = await response.arrayBuffer();
		context.responseType = "arraybuffer";
		callbacks.onSuccess({url: context.url, data: buffer}, this.stats, context, null);
	}

	abort(): void
	{
		console.log("abort");
	}
}
