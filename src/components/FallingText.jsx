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
  antiGravityDelay = 2500,
  preFallDelay = 120,
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const antiTimerRef = useRef(null);
  const preFallTimerRef = useRef(null);
  const returnConstraintsRef = useRef(null);
  const checkTimerRef = useRef(null);

  const [effectStarted, setEffectStarted] = useState(trigger === "auto");

  useEffect(() => {
    if (!textRef.current) return;
    const words = text.split(" ");
    const newHTML = words
      .map((word) => {
        const isHighlighted = highlightWords.some((hw) => word.startsWith(hw));
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
        } catch (err) {
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

    // Schedule anti-gravity reversal after delay (pull words upward then return them to original positions)
    if (antiGravityDelay > 0) {
      antiTimerRef.current = setTimeout(() => {
        try {
          const { Constraint } = Matter;

          // record original positions (based on where we created bodies)
          // create constraints to pull each body toward its original place
          const constraints = wordBodies.map(({ body, elem }) => {
            // calculate original point relative to world (we used body.position when creating)
            const px = body.position.x;
            const py = body.position.y;
            return Constraint.create({
              pointA: { x: px, y: py },
              bodyB: body,
              pointB: { x: 0, y: 0 },
              length: 0,
              stiffness: 0.06,
              damping: 0.1,
            });
          });
          returnConstraintsRef.current = constraints;
          World.add(engine.world, constraints);

          // invert gravity briefly to create the anti-gravity pull
          engine.world.gravity.y = -Math.abs(gravity);
          wordBodies.forEach(({ body }) => {
            Matter.Body.applyForce(body, body.position, { x: 0, y: -0.02 });
          });

          // after a short moment, reduce gravity and watch for settling near original points
          setTimeout(() => {
            try { engine.world.gravity.y = 0; } catch (err) {}

            // poll to detect when bodies are close to their anchor points
            checkTimerRef.current = setInterval(() => {
              try {
                const allNear = wordBodies.every(({ body }) => {
                  // find any constraint that anchors this body
                  const near = constraints.find((c) => c.bodyB === body);
                  if (!near) return false;
                  const dx = body.position.x - near.pointA.x;
                  const dy = body.position.y - near.pointA.y;
                  return Math.hypot(dx, dy) < 4;
                });
                if (allNear) {
                  // settled: remove constraints, stop physics and restore DOM layout
                  if (checkTimerRef.current) { clearInterval(checkTimerRef.current); checkTimerRef.current = null; }
                  if (returnConstraintsRef.current) {
                    try { World.remove(engine.world, returnConstraintsRef.current); } catch (err) {}
                    returnConstraintsRef.current = null;
                  }

                  try { Render.stop(render); Runner.stop(runner); } catch (err) {}
                  if (render.canvas && canvasContainerRef.current) {
                    try {
                      if (render.canvas.parentNode === canvasContainerRef.current) {
                        canvasContainerRef.current.removeChild(render.canvas);
                      }
                    } catch (err) {}
                  }
                  try { World.clear(engine.world); Engine.clear(engine); } catch (err) {}

                  // clear inline styles so words flow back into their original positions
                  wordBodies.forEach(({ elem }) => {
                    elem.style.position = "";
                    elem.style.left = "";
                    elem.style.top = "";
                    elem.style.transform = "";
                  });
                }
              } catch (err) {}
            }, 80);

            // fallback: force restore after 3s
            setTimeout(() => {
              if (checkTimerRef.current) { clearInterval(checkTimerRef.current); checkTimerRef.current = null; }
              if (returnConstraintsRef.current) { try { World.remove(engine.world, returnConstraintsRef.current); } catch (err) {} returnConstraintsRef.current = null; }
              try { Render.stop(render); Runner.stop(runner); } catch (err) {}
              if (render.canvas && canvasContainerRef.current) {
                try {
                  if (render.canvas.parentNode === canvasContainerRef.current) {
                    canvasContainerRef.current.removeChild(render.canvas);
                  }
                } catch (err) {}
              }
              try { World.clear(engine.world); Engine.clear(engine); } catch (err) {}
              wordBodies.forEach(({ elem }) => {
                elem.style.position = "";
                elem.style.left = "";
                elem.style.top = "";
                elem.style.transform = "";
              });
            }, 3000);
          }, 200);
        } catch (err) {
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
        try {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          if (render.canvas.parentNode === canvasContainerRef.current) {
            canvasContainerRef.current.removeChild(render.canvas);
          }
        } catch (err) {}
      }
      World.clear(engine.world);
      Engine.clear(engine);
      if (antiTimerRef.current) {
        clearTimeout(antiTimerRef.current);
      }
      if (preFallTimerRef.current) {
        clearTimeout(preFallTimerRef.current);
      }
      if (checkTimerRef.current) {
        clearInterval(checkTimerRef.current);
      }
      if (returnConstraintsRef.current) {
        try { World.remove(engine.world, returnConstraintsRef.current); } catch (err) {}
        returnConstraintsRef.current = null;
      }
    };
  }, [
    effectStarted,
    gravity,
    wireframes,
    backgroundColor,
    mouseConstraintStiffness,
    antiGravityDelay,
    preFallDelay,
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