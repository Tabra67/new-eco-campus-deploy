import { useEffect } from 'react';

const DebugRoute = ({ children, routeName }) => {
  useEffect(() => {
    console.log(`✅ [DebugRoute] Route "${routeName}" rendered successfully`);
  }, [routeName]);

  // Log if children is empty or falsy
  if (!children || (Array.isArray(children) && children.length === 0)) {
    console.warn(`⚠️ [DebugRoute] Route "${routeName}" has empty children or component is missing`);
  }

  return (
    <div style={{ border: '2px dashed red', padding: '10px' }}>
      {children || (
        <p style={{ color: 'red' }}>
          ⚠️ DebugRoute: "{routeName}" has no component rendered
        </p>
      )}
    </div>
  );
};

export default DebugRoute;