"use strict";

/*
================================================================================
Stepper & Progress (extracted from js/configurator.js)
Classic script — shares the global scope with configurator.js.
Must be loaded BEFORE js/configurator.js.

Dependencies resolved from the shared global scope at call time:
  - js/configurator.js : stateRestorePending, S, locationError, installCost
Global exposure remains in js/configurator.js:
  - window.updateStepperProgress = updateStepperProgress;
genericClickForStepper is registered as a document-level click listener from
initConfigurator() in js/configurator.js (call sites unchanged).
================================================================================
*/

function updateStepperProgress() {
  // Do not update stepper progress during restoration
  if (stateRestorePending) return;

  const stepDesign = document.getElementById('st-design');
  const stepSinkType = document.getElementById('st-sink-type');
  const stepSize = document.getElementById('st-size');
  const stepPartition = document.getElementById('st-partition');
  const stepHandle = document.getElementById('st-handle');
  const stepLocation = document.getElementById('st-location');

  // Reset all stepper steps to initial state
  const allSteps = [stepSinkType, stepSize, stepDesign, stepPartition, stepHandle, stepLocation];
  allSteps.forEach(el => {
    if (el) {
      el.classList.remove('completed', 'half-completed', 'active', 'out-of-range');
    }
  });

  const hasSelectedDesign = Boolean(typeof S !== 'undefined' && S.design && (S.design.id || S.design.name || S.design.type));
  const hasSelectedColor = Boolean(typeof S !== 'undefined' && Array.isArray(S.selectedColors) && S.selectedColors.length >= 1);

  const isDesignFullyCompleted = hasSelectedDesign && hasSelectedColor;
  const isDesignHalfCompleted = (hasSelectedDesign && !hasSelectedColor) || (!hasSelectedDesign && hasSelectedColor);

  const noH = Boolean(typeof S !== 'undefined' && S.design && S.design.hc === 0);
  const isMultiShapeHandle = typeof S !== 'undefined' && S.handle && (S.handle.id === '4c_h&k01' || S.handle.id === '4c_h&k02');
  
  const handleShapesCount = (isMultiShapeHandle && Array.isArray(S.selectedHandleShapes)) ? S.selectedHandleShapes.length : 0;
  
  const isHandleFullyCompleted = typeof S !== 'undefined' && (
    noH || 
    (isMultiShapeHandle ? handleShapesCount >= 2 : Boolean(S.handle))
  );

  const isHandleHalfCompleted = !isHandleFullyCompleted && isMultiShapeHandle && handleShapesCount > 0;

  const hasSinkType = Boolean(typeof S !== 'undefined' && S.sinkType);
  const hasSize = Boolean(typeof S !== 'undefined' && S.size);
  const hasDiv = Boolean(typeof S !== 'undefined' && S.div);

  const errorMsgElement = document.body.innerText.includes('خارج نطاق خدمتنا');
  const isOutOfRange = (typeof locationError !== 'undefined' && locationError === true) || errorMsgElement;
  const hasLocation = typeof installCost !== 'undefined' && installCost !== null && !isOutOfRange;

  if (stepSinkType) {
    if (hasSinkType) stepSinkType.classList.add('completed'); else stepSinkType.classList.remove('completed');
  }

  if (stepDesign) {
    stepDesign.classList.remove('completed', 'half-completed');
    if (isDesignFullyCompleted) {
      stepDesign.classList.add('completed');
    } else if (isDesignHalfCompleted) {
      stepDesign.classList.add('half-completed');
    }
  }

  if (stepSize) {
    if (hasSize) stepSize.classList.add('completed'); else stepSize.classList.remove('completed');
  }

  if (stepPartition) {
    if (hasDiv) stepPartition.classList.add('completed'); else stepPartition.classList.remove('completed');
  }

  if (stepHandle) {
    stepHandle.classList.remove('completed', 'half-completed');
    if (isHandleFullyCompleted) {
      stepHandle.classList.add('completed');
    } else if (isHandleHalfCompleted) {
      stepHandle.classList.add('half-completed');
    }
  }

  if (stepLocation) {
    if (hasLocation) {
      stepLocation.classList.add('completed');
      stepLocation.classList.remove('out-of-range');
    } else if (isOutOfRange) {
      stepLocation.classList.remove('completed');
      stepLocation.classList.add('out-of-range');
    } else {
      stepLocation.classList.remove('completed', 'out-of-range');
    }
  }

  allSteps.forEach(el => {
    if (!el) return;
    el.classList.remove('active');
    if (!el.dataset.scrollListenerSetup) {
      el.dataset.scrollListenerSetup = 'true';
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const step = el.dataset.step;
        const targetMap = {
          'sink-type': 'sink-types',
          'size': 'sz',
          'design': 'dc',
          'partition': 'vc-wall',
          'handle': 'hc',
          'location': 'btn-locate'
        };
        const targetId = targetMap[step];
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  });

  if (!hasSinkType) {
    if (stepSinkType) stepSinkType.classList.add('active');
  } else if (!hasSize) {
    if (stepSize) stepSize.classList.add('active');
  } else if (!isDesignFullyCompleted) {
    if (stepDesign) stepDesign.classList.add('active');
  } else if (!hasDiv) {
    if (stepPartition) stepPartition.classList.add('active');
  } else if (!isHandleFullyCompleted) {
    if (stepHandle) stepHandle.classList.add('active');
  } else if (!hasLocation) {
    if (stepLocation) stepLocation.classList.add('active');
  }
}

function genericClickForStepper(e) {
  if (e.target.closest('.card') || e.target.closest('.option') || e.target.closest('button')) {
    setTimeout(updateStepperProgress, 120);
  }
}