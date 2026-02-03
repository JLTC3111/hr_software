import { useRef, useState, useEffect } from "react";
import Matter from "matter-js";
import "./FallingText.css";

const FallingText = ({
  className = '',
  text = '',
  highlightWords = [],
  highlightClass = "highlighted",
  trigger = "hover",
  backgroundColor = "transparent",
  wireframes = false,
  gravity = 1,
  mouseConstraintStiffness = 0.9,
  fontSize = "1rem",
  antiGravityDelay = 3500,
  preFallDelay = 120,
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const antiTimerRef = useRef(null);
  const preFallTimerRef = useRef(null);

  const [effectStarted, setEffectStarted] = useState(trigger === "auto");

  useEffect(() => {
    if (!textRef.current) return;
    const words = text.split(/\s+/);
    const _lowerHighlights = (highlightWords || []).map((hw) => (hw || "").toString().toLowerCase());
    const newHTML = words
      .map((word) => {
        const isHighlighted = highlightWords.some((hw) => word.startsWith(hw));
        // Normalize by stripping leading/trailing punctuation and lowercasing
        const _cleaned = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").toLowerCase();
        return `<span class="word ${isHighlighted ? highlightClass : ""}">${word}</span>`;
      })
      .join(" ");
    textRef.current.innerHTML = newHTML;
  }, [text, highlightWords, highlightClass]);

  useEffect(() => {
    if (trigger === "auto") {
      setEffectStarted(true);
      return;
    }
    if (trigger === "scroll" && containerRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setEffectStarted(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
    // For hover and click, effectStarted is set by handleTrigger
  }, [trigger]);

  useEffect(() => {
    if (!effectStarted) return;

    // Clear any existing anti-gravity timer
    if (antiTimerRef.current) {
      clearTimeout(antiTimerRef.current);
      antiTimerRef.current = null;
    }

    const {
      Engine,
      Render,
      World,
      Bodies,
      Runner,
      Mouse,
      MouseConstraint,
    } = Matter;

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    if (width <= 0 || height <= 0) {
      return;
    }

    const engine = Engine.create();
    // Start with gravity disabled so we can snap text back to original positions
    engine.world.gravity.y = 0;

    const render = Render.create({
      element: canvasContainerRef.current,
      engine,
      options: {
        width,
        height,
        background: backgroundColor,
        wireframes,
      },
    });

    const boundaryOptions = {
      isStatic: true,
      render: { fillStyle: "transparent" },
    };
    const floor = Bodies.rectangle(width / 2, height + 25, width, 50, boundaryOptions);
    const leftWall = Bodies.rectangle(-25, height / 2, 50, height, boundaryOptions);
    const rightWall = Bodies.rectangle(width + 25, height / 2, 50, height, boundaryOptions);
    const ceiling = Bodies.rectangle(width / 2, -25, width, 50, boundaryOptions);

    const wordSpans = textRef.current.querySelectorAll(".word");
    const wordBodies = [...wordSpans].map((elem) => {
      const rect = elem.getBoundingClientRect();

      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      const body = Bodies.rectangle(x, y, rect.width, rect.height, {
        render: { fillStyle: "transparent" },
        restitution: 0.8,
        frictionAir: 0.01,
        friction: 0.2,
      });
      // start static-like (no initial velocity); we'll nudge when gravity is enabled
      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(body, 0);
      return { elem, body };
    });

    wordBodies.forEach(({ elem, body }) => {
      elem.style.position = "absolute";
      elem.style.left = `${body.position.x}px`;
      elem.style.top = `${body.position.y}px`;
      elem.style.transform = "translate(-50%, -50%)";
    });

    const mouse = Mouse.create(containerRef.current);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: mouseConstraintStiffness,
        render: { visible: false },
      },
    });
    render.mouse = mouse;

    World.add(engine.world, [
      floor,
      leftWall,
      rightWall,
      ceiling,
      mouseConstraint,
      ...wordBodies.map((wb) => wb.body),
    ]);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);
    // Schedule enabling gravity after a short pre-fall delay so elements snap back to their original positions
    if (preFallDelay > 0) {
      preFallTimerRef.current = setTimeout(() => {
        try {
          engine.world.gravity.y = gravity;
          // give each word a little random nudge to start the falling motion
          wordBodies.forEach(({ body }) => {
            Matter.Body.setVelocity(body, {
              x: (Math.random() - 0.5) * 6,
              y: Math.random() * 2
            });
            Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
          });
        } catch (_err) {
          // ignore if engine cleared
        }
      }, preFallDelay);
    } else {
      // If no delay requested, enable gravity immediately and nudge
      engine.world.gravity.y = gravity;
      wordBodies.forEach(({ body }) => {
        Matter.Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 6,
          y: Math.random() * 2
        });
        Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
      });
    }

    // Schedule anti-gravity reversal after delay (pull words upward)
    if (antiGravityDelay > 0) {
      antiTimerRef.current = setTimeout(() => {
        try {
          // Set upward gravity to create an anti-gravity pull
          engine.world.gravity.y = -Math.abs(gravity);

          // Compute center target
          const targetY = height / 2;
          const targetX = width / 2;

          // Pull each word toward the center of the container
          wordBodies.forEach(({ body }) => {
            const { x, y } = body.position;
            // velocity toward center (smoothed)
            const vY = (targetY - y) * 0.3; // negative if below center -> moves up
            const vX = (targetX - x) * 0.06; // gentle horizontal centering
            Matter.Body.setVelocity(body, { x: vX, y: vY });
            Matter.Body.setAngularVelocity(body, 0);
            // slight reduction in air friction to allow smoother travel
            body.frictionAir = 0.02;
          });
        } catch (_err) {
          // ignore if engine cleared
        }
      }, antiGravityDelay);
    }


    const updateLoop = () => {
      wordBodies.forEach(({ body, elem }) => {
        const { x, y } = body.position;
        elem.style.left = `${x}px`;
        elem.style.top = `${y}px`;
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      });
      requestAnimationFrame(updateLoop);
    };
    updateLoop();

    return () => {
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas && canvasContainerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        canvasContainerRef.current.removeChild(render.canvas);
      }
      World.clear(engine.world);
      Engine.clear(engine);
      if (antiTimerRef.current) {
        clearTimeout(antiTimerRef.current);
      }
      if (preFallTimerRef.current) {
        clearTimeout(preFallTimerRef.current);
      }
    };
  }, [
    effectStarted,
    gravity,
    wireframes,
    backgroundColor,
    mouseConstraintStiffness,
    antiGravityDelay,
  ]);

  const handleTrigger = () => {
    if (trigger === "click" || trigger === "hover") {
      // Toggle effect: start if not started, reset if already started
      setEffectStarted(!effectStarted);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`falling-text-container ${className}`}
      onClick={trigger === "click" ? handleTrigger : undefined}
      onMouseEnter={trigger === "hover" ? handleTrigger : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        ref={textRef}
        className="falling-text-target"
        style={{
          fontSize: fontSize,
          lineHeight: 1.4,
        }}
      />
      <div ref={canvasContainerRef} className="falling-text-canvas" />
    </div>
  );
};

export default FallingText;

{/*import FallingText from './FallingText';
  
<FallingText
  text={`React Bits is a library of animated and interactive React components designed to streamline UI development and simplify your workflow.`}
  highlightWords={["React", "Bits", "animated", "components", "simplify"]}
  highlightClass="highlighted"
  trigger="hover"
  backgroundColor="transparent"
  wireframes={false}
  gravity={0.56}
  fontSize="2rem"
  mouseConstraintStiffness={0.9}
/>*/}