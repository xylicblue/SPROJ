// src/components/Spinner.jsx
import React from "react";
import "./spinner.css";

const Spinner = ({ text = "Loading..." }) => {
  return (
    <div className="spinner-overlay">
      <div className="spinner"></div>
      <p className="spinner-text">{text}</p>
    </div>
  );
};

export default Spinner;
