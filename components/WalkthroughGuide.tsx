import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { AppView } from '../App';
import { walkthroughSteps, WalkthroughStep } from './walkthroughConfig';

interface WalkthroughGuideProps {
  onFinish: () => void;
  setView: (view: AppView) => void;
  currentView: AppView;
}

const getTooltipPosition = (rect: DOMRect, placement = 'bottom') => {
    const styles: React.CSSProperties = {};
    const gap = 16;
    const tooltipWidth = 320;
    const viewportMargin = 16;
    const isMobile = window.innerWidth < 768;
    let effectivePlacement = placement;

    // Handle centered placement like a modal, this is a special case
    if (placement === 'center') {
        styles.top = `${rect.top + rect.height / 2}px`;
        styles.left = `${rect.left + rect.width / 2}px`;
        styles.transform = 'translate(-50%, -50%)';
        return styles;
    }

    // On mobile, force placement to be 'top' or 'bottom' for optimal viewing,
    // overriding the default placement from the step config.
    if (isMobile) {
        // If target's center is in the bottom half of the screen, place tooltip on top.
        if (rect.top + rect.height / 2 > window.innerHeight / 2) {
            effectivePlacement = 'top';
        } else {
            effectivePlacement = 'bottom';
        }
    } else {
        // On desktop, check if there is enough space for left/right placement and flip if needed.
        if (placement === 'right' && (rect.right + gap + tooltipWidth > window.innerWidth - viewportMargin)) {
            effectivePlacement = 'left';
        }
        if (placement === 'left' && (rect.left - gap - tooltipWidth < viewportMargin)) {
            effectivePlacement = 'right';
        }
        // For top placement on an element that is far right, 'left' might be better.
        if (placement === 'top' && (rect.left + rect.width / 2 > window.innerWidth / 2) && (rect.left - gap - tooltipWidth > viewportMargin)) {
            effectivePlacement = 'left';
        }
    }

    // Apply styling based on the final determined placement.
    switch (effectivePlacement) {
        case 'top':
            styles.top = `${rect.top - gap}px`;
            styles.transform = 'translateY(-100%)';
            break;
        case 'left':
            styles.top = `${rect.top + rect.height / 2}px`;
            styles.left = `${rect.left - gap}px`;
            styles.transform = 'translate(-100%, -50%)';
            break;
        case 'right':
            styles.top = `${rect.top + rect.height / 2}px`;
            styles.left = `${rect.right + gap}px`;
            styles.transform = 'translateY(-50%)';
            break;
        default: // bottom
            styles.top = `${rect.bottom + gap}px`;
            break;
    }

    // For 'top' and 'bottom' placements, we need to calculate the horizontal position
    // to ensure the tooltip is centered relative to the target and stays within the viewport.
    if (effectivePlacement === 'top' || effectivePlacement === 'bottom') {
        const actualTooltipWidth = Math.min(tooltipWidth, window.innerWidth - (viewportMargin * 2));
        let left = (rect.left + rect.width / 2) - (actualTooltipWidth / 2);

        // Adjust if it goes off-screen to the left or right.
        if (left < viewportMargin) {
            left = viewportMargin;
        } else if (left + actualTooltipWidth > window.innerWidth - viewportMargin) {
            left = window.innerWidth - actualTooltipWidth - viewportMargin;
        }
        styles.left = `${left}px`;
    }

    return styles;
};


export const WalkthroughGuide: React.FC<WalkthroughGuideProps> = ({ onFinish, setView, currentView }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    const currentStep = walkthroughSteps[currentStepIndex];

    const getSelectorForCurrentStep = useCallback(() => {
        if (!currentStep) return null;
        const isMobile = window.innerWidth < 768;
        let selector = currentStep.targetSelector;
        if (isMobile) {
            const mobileSelector = currentStep.targetSelector.replace('"]', '-mobile"]');
            if (document.querySelector(mobileSelector)) {
                selector = mobileSelector;
            }
        }
        return selector;
    }, [currentStep]);
    
    const advanceStep = () => {
        const isClickStep = currentStep?.clickOnNext;

        if (isClickStep) {
            const selector = getSelectorForCurrentStep();
            if (selector) {
                const element = document.querySelector(selector) as HTMLElement;
                if (element) {
                    element.click();
                }
            }
            setTimeout(() => {
                if (currentStepIndex < walkthroughSteps.length - 1) {
                    setCurrentStepIndex(prev => prev + 1);
                } else {
                    onFinish();
                }
            }, 300);
        } else {
            if (currentStepIndex < walkthroughSteps.length - 1) {
                setCurrentStepIndex(prev => prev + 1);
            } else {
                onFinish();
            }
        }
    };
    
    const goToPrevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };
    
     const updateTargetRect = useCallback(() => {
        const selector = getSelectorForCurrentStep();
        if (!selector) {
            setTargetRect(null);
            return;
        }

        let attempts = 0;
        const maxAttempts = 15;
        const intervalTime = 100;

        const tryFindingElement = () => {
            const element = document.querySelector(selector);
            
            if (element) {
                const rect = element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    const isFullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
                    if (!isFullyVisible) {
                        element.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'nearest',
                        });
                        setTimeout(() => {
                           const newRect = element.getBoundingClientRect();
                           // Only update if the element is still valid
                           if (newRect.width > 0 && newRect.height > 0) {
                               setTargetRect(newRect);
                           }
                        }, 400); 
                    } else {
                        setTargetRect(rect);
                    }
                    return; // Success
                }
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(tryFindingElement, intervalTime);
            } else {
                console.warn(`Walkthrough: Could not find or measure element: ${selector}`);
                setTargetRect(null); // Failed
            }
        };

        tryFindingElement();
    }, [currentStep, getSelectorForCurrentStep]);

    // Effect to handle view changes
    useEffect(() => {
        if (currentStep?.view && currentStep.view !== currentView) {
            setView(currentStep.view);
        }
    }, [currentStep, currentView, setView]);

    // Effect to update the target rect when the view is stable
    useLayoutEffect(() => {
        if (currentStep?.view && currentStep.view !== currentView) {
            setTargetRect(null); // Clear rect while view is changing
            return; // Wait for the correct view
        }
        
        updateTargetRect();
        
        const handleResizeAndScroll = () => {
            const selector = getSelectorForCurrentStep();
            if (!selector) return;
            const element = document.querySelector(selector);
            if(element) {
                setTargetRect(element.getBoundingClientRect());
            } else {
                // If element is not found on scroll (e.g., after a click transition), re-run finder logic
                updateTargetRect();
            }
        };

        window.addEventListener('resize', handleResizeAndScroll);
        window.addEventListener('scroll', handleResizeAndScroll, true);
        
        return () => {
            window.removeEventListener('resize', handleResizeAndScroll);
            window.removeEventListener('scroll', handleResizeAndScroll, true);
        };
    }, [currentStep, currentView, updateTargetRect, getSelectorForCurrentStep]);
    
    if (!targetRect || !currentStep) {
        return null;
    }

    const highlightStyle: React.CSSProperties = {
        top: `${targetRect.top - 4}px`,
        left: `${targetRect.left - 4}px`,
        width: `${targetRect.width + 8}px`,
        height: `${targetRect.height + 8}px`,
    };

    const tooltipStyle = getTooltipPosition(targetRect, currentStep.placement);
    
    return (
        <div className="fixed inset-0 z-[9998]">
            <div className={`walkthrough-highlight ${currentStep.isRect ? 'rect' : ''}`} style={highlightStyle}></div>
            <div className="walkthrough-tooltip" style={tooltipStyle}>
                <div className="glass-pane p-5 rounded-xl shadow-2xl animate-scale-in-center">
                    <h3 className="text-lg font-bold text-teal-300 mb-2">{currentStep.title}</h3>
                    <p className="text-gray-300 text-sm mb-4">{currentStep.content}</p>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{currentStepIndex + 1} / {walkthroughSteps.length}</span>
                        <div className="flex space-x-2 items-center">
                             {currentStepIndex === 0 && (
                                <button onClick={onFinish} className="px-3 py-1.5 text-xs font-semibold rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                    Saltar Tutorial
                                </button>
                            )}
                            {currentStepIndex > 0 && (
                                <button onClick={goToPrevStep} className="px-3 py-1.5 text-xs font-semibold rounded-md text-gray-300 hover:bg-white/10 transition-colors">
                                    Anterior
                                </button>
                            )}
                             <button 
                                onClick={advanceStep} 
                                className="px-4 py-1.5 text-sm font-semibold rounded-md bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                            >
                                {currentStepIndex === walkthroughSteps.length - 1 ? 'Finalizar' : 'Siguiente'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
