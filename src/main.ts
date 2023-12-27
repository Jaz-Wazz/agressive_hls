import Hls, { FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext } from "hls.js";

class CustomLoader extends (<new (confg: HlsConfig) => Loader<FragmentLoaderContext>> Hls.DefaultConfig.loader)
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

window.onload = () =>
{
	let player = document.getElementById("player");

	if(player instanceof HTMLVideoElement)
	{
		let hls = new Hls({fLoader: CustomLoader, enableWorker: true});
		hls.loadSource('http://ia800509.s3dns.us.archive.org/moddychat_2023.07.05_12.05_test/index-dvr.m3u8');
		hls.attachMedia(player);
	}
	else
	{
		console.error("Not find #player.");
	}
};
