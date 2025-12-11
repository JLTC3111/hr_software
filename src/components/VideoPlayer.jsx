import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Video } from 'lucide-react';

const VideoPlayer = ({ videos }) => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const currentVideo = videos[currentVideoIndex];

  const handleNext = () => {
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length);
    setIsPlaying(false);
  };

  const handlePrev = () => {
    setCurrentVideoIndex((prevIndex) => (prevIndex - 1 + videos.length) % videos.length);
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // When video source changes, ensure it's paused and ready to play
  const handleLoadedData = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="video-player-container bg-gray-900 rounded-lg p-4 shadow-xl">
      <div className="video-title flex items-center mb-3 text-white">
        <Video className="mr-2 h-5 w-5 text-indigo-400" />
        <h3 className="text-lg font-semibold">{currentVideo.name}</h3>
      </div>

      {/* Video Element */}
      <video
        ref={videoRef}
        key={currentVideo.src} // Key forces video element refresh on source change
        src={currentVideo.src}
        onLoadedData={handleLoadedData}
        className="w-full h-auto max-h-96 rounded-md bg-black"
        poster="/video-placeholder.jpg" // Optional: Add a placeholder image
        controls={false} // Custom controls below
      >
        Your browser does not support the video tag.
      </video>

      {/* Custom Controls */}
      <div className="controls flex justify-between items-center mt-3">
        {/* Previous Button */}
        <button
          onClick={handlePrev}
          disabled={videos.length <= 1}
          className="p-2 rounded-full text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition duration-150"
          aria-label="Previous video"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="p-3 rounded-full text-white bg-green-500 hover:bg-green-600 transition duration-150 shadow-md"
          aria-label={isPlaying ? "Pause video" : "Play video"}
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-white" />}
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={videos.length <= 1}
          className="p-2 rounded-full text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition duration-150"
          aria-label="Next video"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default VideoPlayer;