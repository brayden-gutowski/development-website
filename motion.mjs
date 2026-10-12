export function springStep(position, velocity, target, deltaTime) {
  const dt = Math.max(0, Math.min(deltaTime, 0.05));
  const displacement = position - target;
  const decay = Math.exp(-12 * dt);
  const frequency = Math.sqrt(190 - 144);
  const cosine = Math.cos(frequency * dt);
  const sine = Math.sin(frequency * dt);
  const coefficient = (velocity + 12 * displacement) / frequency;
  return {
    position: target + decay * (displacement * cosine + coefficient * sine),
    velocity: decay * (velocity * cosine - (12 * coefficient + frequency * displacement) * sine),
  };
}

export function resistBoundary(value, min, max, limit = 0.18) {
  const edge = Math.max(min, Math.min(max, value));
  const distance = value - edge;
  return edge + distance / (1 + Math.abs(distance) / limit);
}
