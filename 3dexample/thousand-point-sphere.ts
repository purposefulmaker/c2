// Thousand Point Sphere - 600 visible + 400 resonance field
export interface Point3D \{
  x: number;
  y: number;
  z: number;
  index: number;
  type: 'visible' | 'resonance';
  resonance: number; // Current resonance value (0-1)
  originalX: number;
  originalY: number;
  originalZ: number;
  // Optional additional properties for rendering or physics
  color?: \{ r: number; g: number; b: number; a?: number \};
  intensity?: number;
\}

export interface ActivationField \{
  visibleDots: number[];    // Indices of visible dots to activate
  resonanceDots: number[];  // Indices of resonance dots to activate
  intensity: number;        // Overall intensity of the activation (0-1)
  color: string;            // Primary color for this activation (hex)
  frequency: number;        // Associated frequency in Hz
  // Optional: pattern-specific data
  patternName?: string;
  totalActivated?: number; // For UI or logic
\}

export class ThousandPointSphere \{
  private visiblePoints: Point3D[] = [];
  private resonancePoints: Point3D[] = [];
  public allPoints: Point3D[] = []; // Made public for easier access if needed
  
  constructor() \{
    this.initializePoints();
  \}
  
  private initializePoints() \{
    this.visiblePoints = this.generateFibonacciSphere(600);
    this.resonancePoints = this.generateResonanceGrid(400); // Ensure this generates 400 points
    
    this.allPoints = [...this.visiblePoints, ...this.resonancePoints];
    console.log(`🔮 Generated 1000-point field: $\{this.visiblePoints.length\} visible + $\{this.resonancePoints.length\} resonance`);
  \}
  
  private generateFibonacciSphere(count: number): Point3D[] \{
    const points: Point3D[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    
    for (let i = 0; i < count; i++) \{
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      points.push(\{
        x, y, z,
        originalX: x, originalY: y, originalZ: z,
        index: i,
        type: 'visible',
        resonance: 0
      \});
    \}
    return points;
  \}
  
  private generateResonanceGrid(count: number): Point3D[] \{
    // This is a simplified placeholder. A true tetrahedral grid is more complex.
    // For now, using a slightly different Fibonacci spiral for resonance points.
    const points: Point3D[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)) * 1.1; // Slightly different angle

    for (let i = 0; i < count; i++) \{
        const y = 1 - (i / (count - 1)) * 2; 
        const radius = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;

        const x = Math.cos(theta) * radius * 0.95; // Slightly offset scale
        const z = Math.sin(theta) * radius * 0.95;

        points.push(\{
            x, y, z,
            originalX: x, originalY: y, originalZ: z,
            index: 600 + i, // Offset index for resonance points
            type: 'resonance',
            resonance: 0.1 // Base resonance for these points
        \});
    \}
    return points;
  \}
  
  getAllPoints(): Point3D[] \{
    return this.allPoints;
  \}
  
  getVisiblePoints(): Point3D[] \{
    return this.visiblePoints;
  \}
  
  getResonancePoints(): Point3D[] \{
    return this.resonancePoints;
  \}
  
  activatePattern(pattern: ActivationField): void \{
    this.allPoints.forEach(point => \{
      point.resonance = point.type === 'resonance' ? 0.1 : 0; // Reset with base resonance
      point.intensity = 0;
      point.color = undefined;
    \});
    
    const activate = (dotIndices: number[], isResonanceType: boolean) => \{
      dotIndices.forEach(index => \{
        const point = this.allPoints.find(p => p.index === index && (isResonanceType ? p.type === 'resonance' : p.type === 'visible'));
        if (point) \{
          point.resonance = Math.max(point.resonance, pattern.intensity);
          point.intensity = pattern.intensity;
          // point.color = hexToRgb(pattern.color); // Assuming hexToRgb utility
        \}
      \});
    \};

    activate(pattern.visibleDots, false);
    activate(pattern.resonanceDots, true);
  \}
  
  applyLambdaPsiTransform(rotationState: \{
    theta: number; // degrees
    phi: number;   // degrees
    psi: number;   // degrees
  \}): ActivationField \{
    const \{ theta, phi, psi \} = rotationState;
    
    const lambdaActivation = this.activateLinearMeridian(theta);
    const psiActivation = this.activateTripleSpiral(phi, psi);
    
    const combinedVisible = Array.from(new Set([...lambdaActivation.visible, ...psiActivation.visible]));
    const combinedResonance = Array.from(new Set([...lambdaActivation.resonance, ...psiActivation.resonance]));
    
    // Calculate intensity based on how close the rotation is to a "pure" lambda or psi state
    // This is a conceptual example
    const lambdaFactor = Math.abs(Math.cos(phi * Math.PI / 180)); // Stronger when phi is 0 or 180
    const psiFactor = Math.abs(Math.sin(phi * Math.PI / 180));    // Stronger when phi is 90
    const overallIntensity = Math.max(0.2, (lambdaFactor + psiFactor) / 1.5); // Ensure some base intensity

    return \{
      visibleDots: combinedVisible,
      resonanceDots: combinedResonance,
      intensity: overallIntensity,
      color: '#FF6B9D', // Default color for λΨ transform
      frequency: 528,    // Default frequency
      patternName: 'LambdaPsiTransform',
      totalActivated: combinedVisible.length + combinedResonance.length
    \};
  \}
  
  private activateLinearMeridian(thetaDegrees: number): \{visible: number[], resonance: number[]\} \{
    const visible: number[] = [];
    const resonance: number[] = [];
    const thetaRadians = thetaDegrees * Math.PI / 180;
    const activationBandwidth = 15 * Math.PI / 180; // +/- 15 degrees

    this.allPoints.forEach(point => \{
      if (!point) return;
      const pointTheta = Math.atan2(point.z, point.x); // Azimuthal angle
      let diff = Math.abs(pointTheta - thetaRadians);
      if (diff > Math.PI) diff = 2 * Math.PI - diff; // Handle wrap-around

      if (diff < activationBandwidth) \{
        if (point.type === 'visible') visible.push(point.index);
        else resonance.push(point.index);
      \}
    \});
    return \{ visible, resonance \};
  \}
  
  private activateTripleSpiral(phiDegrees: number, psiDegrees: number): \{visible: number[], resonance: number[]\} \{
    const visible: number[] = [];
    const resonance: number[] = [];
    // This is a simplified representation. True triple spiral activation is complex.
    // Here, we'll activate bands based on phi (polar angle) and modulate by psi (roll)
    const phiRadians = phiDegrees * Math.PI / 180;
    const psiRadians = psiDegrees * Math.PI / 180;
    const activationBandwidth = 20 * Math.PI / 180; // +/- 20 degrees for polar angle

    for (let arm = 0; arm < 3; arm++) \{
        const armOffset = arm * (2 * Math.PI / 3); // 120 degrees apart
        this.allPoints.forEach(point => \{
            if (!point) return;
            const pointPhi = Math.acos(point.y); // Polar angle from y-axis
            const pointTheta = Math.atan2(point.z, point.x); // Azimuthal angle for psi influence

            // Check if within phi band
            if (Math.abs(pointPhi - phiRadians) < activationBandwidth) \{
                // Modulate by psi and arm offset
                const effectivePsi = (pointTheta + psiRadians + armOffset) % (2 * Math.PI);
                if (effectivePsi < Math.PI / 3) \{ // Activate a segment of the spiral arm
                    if (point.type === 'visible') visible.push(point.index);
                    else resonance.push(point.index);
                \}
            \}
        \});
    \}
    return \{ visible, resonance \};
  \}
    
  getFieldCoherence(): number \{
    if (this.allPoints.length === 0) return 0;
    const activePoints = this.allPoints.filter(p => p.resonance > 0.5).length; // Consider points with significant resonance
    return activePoints / this.allPoints.length;
  \}
  
  getFieldState() \{
    const visibleActive = this.visiblePoints.filter(p => p.resonance > 0.5).length;
    const resonanceActive = this.resonancePoints.filter(p => p.resonance > 0.5).length;
    const coherence = this.getFieldCoherence();
    // Field strength could be average resonance of active points or similar
    const totalResonance = this.allPoints.reduce((sum, p) => sum + p.resonance, 0);
    const fieldStrength = this.allPoints.length > 0 ? totalResonance / this.allPoints.length : 0;
    
    return \{
      totalPoints: this.allPoints.length,
      visibleActive,
      resonanceActive,
      coherence,
      fieldStrength, // Added field strength
      phase: this.determinePhase(visibleActive, resonanceActive)
    \};
  \}
  
  private determinePhase(visibleActive: number, resonanceActive: number): string \{
    if (resonanceActive > visibleActive && resonanceActive > 0) return 'Resonance Dominant';
    if (visibleActive > resonanceActive * 2 && visibleActive > 0) return 'Visible Dominant'; 
    if (visibleActive > 0 || resonanceActive > 0) return 'Balanced Activation';
    return 'Quiescent';
  \}
\}

export function createThousandPointSphere(): ThousandPointSphere \{
  return new ThousandPointSphere();
\}
