import React from 'react';

const PillComponent = ({ name, value, isFilled }) => {
  const className = `var-pill ${isFilled ? 'filled' : 'empty'}`;
  return (
    <span className={className} data-var={name}>
      {value}
    </span>
  );
};

export default PillComponent;
