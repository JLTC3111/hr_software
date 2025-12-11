import React from 'react';
import * as LucideIcons from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import { VIDEO_FILES, HELP_FEATURES } from '../services/helpData';

// Helper function to dynamically select Lucide Icons
const Icon = ({ name, ...props }) => {
  const LucideIcon = LucideIcons[name];
  return LucideIcon ? <LucideIcon {...props} /> : null;
};

const AdvancedHelpCenter = ({ contextHint = null }) => {
  // 1. Contextual Help Filtering
  const filteredFeatures = contextHint
    ? HELP_FEATURES.filter(feature => feature.tags.includes(contextHint))
    : HELP_FEATURES;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white border-b pb-3 border-indigo-200 dark:border-indigo-700 flex items-center">
        <LucideIcons.BookOpenText className="mr-3 h-7 w-7 text-indigo-600" />
        Advanced Feature Guide
      </h1>

      {/* 2. Custom Video Player Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center">
          <LucideIcons.Tv className="mr-2 h-6 w-6 text-green-500" />
          Video Tutorials
        </h2>
        <VideoPlayer videos={VIDEO_FILES} />
      </section>

      {/* 3. Demo Restriction Alert (A MUST-HAVE) */}
      <section className="p-4 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 rounded-lg shadow-md">
        <div className="flex items-start">
          <LucideIcons.AlertTriangle className="h-6 w-6 text-red-500 mr-3 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-red-800 dark:text-red-300">
              IMPORTANT: Demo Restrictions!
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              **DATA IS NOT PERSISTENT.** All created records, edits, and deletions will be wiped upon page refresh or closing the browser. Additionally, **Batch Edit** and **Export to CSV** features are disabled in this environment.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Advanced & Contextual Features List */}
      <section>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center">
          <LucideIcons.Lightbulb className="mr-2 h-6 w-6 text-yellow-500 fill-yellow-500" />
          {contextHint ? `Contextual Tips for ${contextHint}` : "Hidden Features & Pro Tips"}
        </h2>
        
        <div className="space-y-4">
          {filteredFeatures.map((feature) => (
            <div key={feature.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 transition hover:shadow-lg">
              <div className="flex items-center mb-2">
                <Icon name={feature.icon} className="h-6 w-6 mr-3 text-indigo-500" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  {feature.title}
                </h4>
                {feature.tags.includes("Restriction") && (
                  <span className="ml-3 px-2 py-0.5 text-xs font-medium text-red-700 bg-red-200 rounded-full dark:text-red-200 dark:bg-red-800">
                    RESTRICTED
                  </span>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                {feature.description}
              </p>
              <div className="mt-2">
                {feature.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {filteredFeatures.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 italic">
                No specific advanced tips found for the context: "{contextHint}". Showing all features below.
              </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdvancedHelpCenter;