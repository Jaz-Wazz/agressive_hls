import Hls from "hls.js";
import { AgressiveHls } from "./agressive_hls";

window.onload = () =>
{
	let player = document.getElementById("player");
	if(!(player instanceof HTMLVideoElement)) throw new Error("Not find #player.");

	let text_area = document.createElement("textarea");
	text_area.spellcheck = false;
	document.body.append(text_area);

	let buffer	= new AgressiveHls.Buffer;
	let hls		= new Hls({fLoader: buffer.make_loader(), enableWorker: true, autoStartLoad: false});

	player.ontimeupdate = () =>
	{
		if(!(player instanceof HTMLVideoElement)) throw new Error("Not find #player.");
		let time = Math.round(player.currentTime).toString();
		if(window.location.hash != time) window.location.hash = time;
	};

	buffer.on_stats_update = (content) => text_area.textContent = content;
	hls.on(Hls.Events.LEVEL_LOADED, (event, data) =>
	{
		buffer.playlist = data.details.fragments;
		hls.startLoad(window.location.hash.length > 0 ? parseInt(window.location.hash.slice(1)) : -1);
	});

	hls.loadSource('http://ia601703.s3dns.us.archive.org/76b6526e/index-muted-Y4POEUXVTL.m3u8');
	hls.attachMedia(player);
};
