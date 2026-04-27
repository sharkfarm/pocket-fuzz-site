"use client";

import Image from "next/image";
import { useState } from "react";

type Show = {
  date: string;
  venue: string;
  city: string;
  note: string;
};

type Track = {
  title: string;
  length: string;
  video: string;
};

export default function Home() {
  const band = {
    name: "Pocket Fuzz",
    tagline: "Fuzzed-out riffs. Big drums. No wasted motion.",
    city: "Denver, Colorado",
    genre: "Garage Rock / 2-Piece / Alternative Rock",
    description:
      "Pocket Fuzz is a stripped-down rock band built on blown-out guitar, hard-hitting drums, and songs that hit fast and stay loud.",
    email: "info@pocket-fuzz.com",
    instagram: "https://instagram.com/pocketfuzzmusic",
    youtube: "https://youtube.com/@PocketFuzz-music",
  };

  const upcomingShows: Show[] = [
    {
      date: "April 19, 2026",
      venue: "303 Boards",
      city: "Denver, CO",
      note: "Doors 4PM",
    },
    {
      date: "June 13, 2026",
      venue: "Lost Lake Lounge",
      city: "Denver, CO",
      note: "With local support",
    },
    {
      date: "July 10, 2026",
      venue: "Moe's Original BBQ",
      city: "Englewood, CO",
      note: "Late set",
    },
  ];

  const tracks: Track[] = [
  	{
	    title: "Bound For The Floor",
	    length: "1:07",
	    video: "https://www.youtube.com/embed/R5Bz41R96KA",
	  },
	  {
	    title: "Dead Leaves and the Dirty Ground",
	    length: "1:39",
	    video: "https://www.youtube.com/embed/OAEi6pvJAg",
	  },
	  {
	    title: "Paint It Black",
	    length: "2:17",
	    video: "https://www.youtube.com/embed/ajaYrBIm_fc",
	  },
	  {
	    title: "Fell In Love With A Girl",
	    length: "1:39",
	    video: "https://www.youtube.com/embed/YlrqZ2IvuVM",
	  },
	  {
	    title: "Your Touch",
 	    length: "1:33",
	    video: "https://www.youtube.com/embed/63T8s85yUQU",
	},
  ];

  const defaultVideo = "https://www.youtube.com/embed/tZoezYyBFCY";
  const [activeVideo, setActiveVideo] = useState(defaultVideo);
  const [activeTitle, setActiveTitle] = useState("");

  const gallery: string[] = [
    "/images/Brandon1.png?auto=format&fit=crop&w=1200&q=80",
    "/images/PocketFuzz1.png?auto=format&fit=crop&w=1200&q=80",
    "/images/Bobby1.png?auto=format&fit=crop&w=1200&q=80",
  ];

  return (
    <div className="min-h-screen bg-[#0a0908] text-stone-100">
      <header className="border-b border-stone-800 bg-[#0a0908]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-2xl font-black uppercase tracking-[0.25em]">
              {band.name}
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-stone-500">
              {band.genre}
            </div>
          </div>
          <nav className="hidden gap-6 text-sm uppercase tracking-widest md:flex">
            <a href="#about" className="text-stone-400 hover:text-white">
              About
            </a>
            <a href="#shows" className="text-stone-400 hover:text-white">
              Shows
            </a>
            <a href="#music" className="text-stone-400 hover:text-white">
              Music
            </a>
            <a href="#gallery" className="text-stone-400 hover:text-white">
              Photos
            </a>
            <a href="#contact" className="text-stone-400 hover:text-white">
              Contact
            </a>
          </nav>
        </div>
      </header>

      <section className="border-b border-stone-900">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center md:py-24">
	<div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-red-500">
              Denver Garage Rock
            </p>
            <h1 className="max-w-4xl text-6xl font-black uppercase leading-[0.9] tracking-tight text-stone-100 md:text-8xl">
              <Image
  		src="/images/Logo2.png"
		  alt="Pocket Fuzz"
		  width={200}
		  height={60}
		  className="h-100 w-auto"
	      />
            </h1>
            <p className="mt-6 max-w-xl text-xl font-semibold text-stone-300">
              {band.tagline}
            </p>
            <p className="mt-6 max-w-xl text-base leading-8 text-stone-400">
              {band.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#music"
                className="rounded-none border border-red-600 bg-red-600 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:translate-y-[-1px]"
              >
                Listen
              </a>
              <a
                href="#shows"
                className="rounded-none border border-stone-700 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-stone-200 transition hover:border-stone-400"
              >
                Shows
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-4 -top-4 h-full w-full border border-red-700/50" />
            <img
              src="/images/PocketFuzz1.png"
              alt="Pocket Fuzz live"
              className="relative h-[460px] w-full border border-stone-800 object-cover grayscale contrast-125"
            />
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-stone-500">
              About
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase">Built Loud.</h2>
          </div>
          <div className="border-l-4 border-red-600 pl-6 text-lg leading-9 text-stone-300">
            Pocket Fuzz plays lean, dirty, riff-heavy rock with zero extra
            gloss. It is the kind of set that works in a small club, a loud
            bar, or a room full of people who want guitars that sound like they
            are about to break. Tight songs, big groove, and enough fuzz to make
            the walls sweat.
          </div>
        </div>
      </section>

      <section id="shows" className="bg-[#11100f] px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-stone-500">
            Shows
          </p>
          <h2 className="mt-4 text-4xl font-black uppercase">Upcoming Dates</h2>
          <div className="mt-8 grid gap-4">
            {upcomingShows.map((show) => (
              <div
                key={`${show.date}-${show.venue}`}
                className="grid gap-3 border border-stone-800 bg-black/30 p-6 md:grid-cols-[180px_1fr_auto] md:items-center"
              >
                <div className="text-sm font-black uppercase tracking-[0.2em] text-red-500">
                  {show.date}
                </div>
                <div>
                  <div className="text-2xl font-bold uppercase">
                    {show.venue}
                  </div>
                  <div className="text-sm uppercase tracking-wider text-stone-500">
                    {show.city}
                  </div>
                </div>
                <div className="text-sm uppercase tracking-wider text-stone-400">
                  {show.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="music" className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-stone-500">
              Music
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase">Tracks</h2>
            <div className="mt-8 border-t border-stone-800">
              {tracks.map((track, index) => (
                <div
                  key={track.title}
                  className="grid grid-cols-[60px_1fr_auto] items-center border-b border-stone-800 py-5"
                >
                  <div className="text-sm font-black text-stone-500">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div>
		    <button
		      type="button"
		      onClick={() => {
	    	        setActiveVideo(track.video);
			setActiveTitle(track.title);

		        setTimeout(() => {
 		        setActiveVideo(defaultVideo);
		        }, 120000); // 2 minutes (adjust per your clips)
		      }}
		      className={`text-left text-xl font-bold uppercase hover:text-red-500 ${
	 	      activeTitle === track.title ? "text-red-500" : "text-stone-100"
		     }`}
		    >
	    	     {track.title}
		    </button>
                  </div>

                  <div className="text-sm text-stone-500">
		      {track.length}
		  </div>
                </div>
              ))}
            </div>
	    <div className="mt-6 flex gap-4">
              <a
                href={band.youtube}
                className="border border-stone-700 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-stone-200 hover:border-white"
              >
                YouTube
              </a>
            </div>
          </div>

          <div className="border border-stone-800 bg-[#11100f] p-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-stone-500">
              Featured Video
            </p>
             <div className="mt-6 border border-stone-700 bg-black p-2">
	      <iframe
	        className="w-full aspect-video"
	        src={activeVideo}
	        title="Pocket Fuzz video"
	        frameBorder="0"
	        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
	        allowFullScreen
	        referrerPolicy="strict-origin-when-cross-origin"
	      ></iframe>
	    </div>

	    <p className="mt-4 text-sm uppercase tracking-[0.2em] text-stone-500">
	      Now playing:{" "}
	      <span className="text-red-500">
	        {activeTitle || "Featured Video"}
	      </span>
	    </p>
          </div>
        </div>
      </section>

      <section id="gallery" className="bg-[#11100f] px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-stone-500">
            Photos
          </p>
          <h2 className="mt-4 text-4xl font-black uppercase">
            Live / Loud / Dirty
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {gallery.map((image, index) => (
              <img
                key={image}
                src={image}
                alt={`Pocket Fuzz photo ${index + 1}`}
                className="h-80 w-full border border-stone-800 object-cover grayscale contrast-125"
              />
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-stone-500">
              Contact
            </p>
            <h2 className="mt-4 text-4xl font-black uppercase">Booking</h2>
            <div className="mt-6 space-y-4 text-lg text-stone-300">
              <p>
                <a
                  href={`mailto:${band.email}?subject=Live%20Show%20Inquiry`}
                  className="text-red-500 hover:text-red-400"
                >
                  {band.email}
                </a>
              </p>
              <p>
                <a
                  href={band.instagram}
                  className="text-red-500 hover:text-red-400"
                >
                  Instagram
                </a>
              </p>
	      <p>
                <a href={band.youtube} className="text-red-500 hover:text-red-400">YouTube</a>
              </p>
	     </div>
            </div>
          </div>
      </section>

      <footer className="border-t border-stone-900 px-6 py-8 text-center text-xs uppercase tracking-[0.25em] text-stone-600">
        Pocket Fuzz • Garage Rock From Denver
      </footer>
    </div>
  );
}