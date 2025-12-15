import React, { useState, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const VideoPlayer = ({ videos }) => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

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

  const videoCountLabel = useMemo(() => `${currentVideoIndex + 1}/${videos.length}`, [currentVideoIndex, videos.length]);

  return (
    <motion.div
      className={`video-player-container rounded-2xl p-4 sm:p-5 shadow-2xl border transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-label={t('videoPlayer.container', 'Video Player')}
    >
      <div className="video-title flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Video className={`h-5 w-5 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`} aria-hidden="true" />
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`} data-i18n="videoPlayer.currentTitle" aria-live="polite">
            {t('videoPlayer.currentTitle', currentVideo.name)}
          </h3>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-indigo-50 text-indigo-700'}`} data-i18n="videoPlayer.counter">
          {t('videoPlayer.counter', videoCountLabel)}
        </span>
      </div>

      {/* Video Element */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-black">
        <video
          ref={videoRef}
          key={currentVideo.src} // Key forces video element refresh on source change
          src={currentVideo.src}
          onLoadedData={handleLoadedData}
          className="w-full h-auto max-h-96"
          poster="/video-placeholder.jpg" // Optional: Add a placeholder image
          controls={false} // Custom controls below
        >
          {t('videoPlayer.unsupported', 'Your browser does not support the video tag.')}
        </video>
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" aria-hidden="true" />
      </div>

      {/* Custom Controls */}
      <div className="controls flex items-center justify-between mt-3 gap-3">
        <button
          onClick={handlePrev}
          disabled={videos.length <= 1}
          className={`p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ${isDarkMode ? 'text-white bg-indigo-700 hover:bg-indigo-600 focus:ring-offset-gray-900' : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-offset-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={t('videoPlayer.prev', 'Previous video')}
          data-i18n="videoPlayer.prev"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          onClick={togglePlay}
          className={`p-3 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ${isDarkMode ? 'text-white bg-green-600 hover:bg-green-500 focus:ring-offset-gray-900' : 'text-white bg-green-500 hover:bg-green-600 focus:ring-offset-white'}`}
          aria-label={isPlaying ? t('videoPlayer.pause', 'Pause video') : t('videoPlayer.play', 'Play video')}
          data-i18n="videoPlayer.playToggle"
        >
          {isPlaying ? <Pause className="h-6 w-6" aria-hidden="true" /> : <Play className="h-6 w-6 fill-white" aria-hidden="true" />}
        </button>

        <button
          onClick={handleNext}
          disabled={videos.length <= 1}
          className={`p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ${isDarkMode ? 'text-white bg-indigo-700 hover:bg-indigo-600 focus:ring-offset-gray-900' : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-offset-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={t('videoPlayer.next', 'Next video')}
          data-i18n="videoPlayer.next"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 text-sm flex items-center justify-between text-gray-600 dark:text-gray-300" aria-live="polite">
        <span data-i18n="videoPlayer.status">{isPlaying ? t('videoPlayer.status.playing', 'Playing') : t('videoPlayer.status.paused', 'Paused')}</span>
        <span className="font-medium" data-i18n="videoPlayer.name">{t('videoPlayer.name', currentVideo.name)}</span>
      </div>
    </motion.div>
  );
};

export default VideoPlayer;