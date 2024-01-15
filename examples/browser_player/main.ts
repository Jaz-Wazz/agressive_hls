import Hls from "hls.js";
import { AgressiveHls } from "agressive_hls";

window.onload = () =>
{
	let player		= document.getElementsByTagName("video")[0];
	let text_area	= document.getElementsByTagName("textarea")[0];

	let buffer	= new AgressiveHls.Buffer;
	let hls		= new Hls({fLoader: buffer.make_loader(), enableWorker: true, autoStartLoad: false});

	player.ontimeupdate = () =>
	{
		let time = Math.round(player.currentTime).toString();
		if(window.location.hash != time) window.location.hash = time;
	};

	buffer.on_stats_update = (content) => text_area.textContent = content;
	hls.on(Hls.Events.LEVEL_LOADED, (event, data) =>
	{
		buffer.playlist = data.details.fragments;
		hls.startLoad(window.location.hash.length > 0 ? parseInt(window.location.hash.slice(1)) : -1);
	});

	hls.loadSource('http://ia801700.s3dns.us.archive.org/04c5d9d9/index-muted-4TQQ5ZAKD0.m3u8');
	hls.attachMedia(player);
};
