import Hls from "hls.js";
import { AgressiveHls } from "agressive_hls";

window.onload = () =>
{
	let player		= document.getElementsByTagName("video")[0];
	let text_area	= document.getElementsByClassName("text_area")[0];

	let buffer	= new AgressiveHls.Buffer({connection_count: 0, advanced_segment_search: true, retry_slow_connections: "fixed"});
	let hls		= new Hls({loader: buffer.make_loader(), enableWorker: true, autoStartLoad: false});

	player.ontimeupdate = () =>
	{
		let time = Math.round(player.currentTime).toString();
		if(window.location.hash != time) window.location.replace(`#${time}`);
	};

	buffer.on_stats_update = (content) => text_area.textContent = content;
	hls.on(Hls.Events.LEVEL_LOADED, (event, data) =>
	{
		buffer.playlist = data.details.fragments;
		hls.startLoad(window.location.hash.length > 0 ? parseInt(window.location.hash.slice(1)) : -1);
	});

	hls.loadSource('https://huggingface.co/datasets/harryvar/ba27265e/resolve/main/playlist/index-dvr.bin');
	hls.attachMedia(player);
};
