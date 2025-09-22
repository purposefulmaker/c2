// import { Canvas } from "@react-three/fiber";
// import { useState, useEffect } from "react";
// import Wormhole from "./Wormhole";

// interface WormholeTransitionProps {
//   children: React.ReactNode;
//   isTransitioning: boolean;
//   onTransitionComplete: () => void;
// }

// export default function WormholeTransition({ 
//   children, 
//   isTransitioning,
//   onTransitionComplete 
// }: WormholeTransitionProps) {
//   return (
//     <div className="w-full h-full relative">
//       {children}
//       {isTransitioning && (
//         <div className="absolute inset-0 z-50">
//           <Canvas>
//             <Wormhole isActive={true} onComplete={onTransitionComplete} />
//           </Canvas>
//         </div>
//       )}
//     </div>
//   );
// }
// export default WormholeTransition;