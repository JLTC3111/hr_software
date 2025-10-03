import React from 'react'

const PlaceholderTab = ({ icon: Icon, title, description }) => (
  <div className="text-center py-12">
    <Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500">{description}</p>
  </div>
);

export default PlaceholderTab;

