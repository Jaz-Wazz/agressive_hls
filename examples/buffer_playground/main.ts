import Hls from "hls.js";
import { AgressiveHls } from "agressive_hls";

declare global
{
	interface Window { subscribe: () => void; }
}

window.onload = () =>
{
	let text_area	= document.getElementsByTagName("textarea")[0];
	let buffer		= new AgressiveHls.Buffer;
	let hls			= new Hls({fLoader: buffer.make_loader(), enableWorker: true, autoStartLoad: false});

	buffer.on_stats_update = (content) => text_area.textContent = content;
	hls.on(Hls.Events.LEVEL_LOADED, (event, data) => buffer.playlist = data.details.fragments);
	hls.loadSource('http://ia601700.s3dns.us.archive.org/659b8ee7/index-muted-YK4PWD7N60.m3u8');

	window.subscribe = () =>
	{
		let index = parseInt(document.getElementsByTagName("input")[0].value);
		buffer.subscribe(index, (buffer) => console.warn("Requested segment", index, "getted, with", buffer.byteLength, "bytes."));
	};
};
