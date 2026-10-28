import { TourProvider, useTour, type Position, type StepType } from "@reactour/tour";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/Button";
import { useSession } from "@shared/session/useSession";

import { fetchOrders } from "../repair-orders/api";
import { NAV_ITEMS } from "../shell/navigation";
import { buildTourSteps, type TourStepDefinition } from "./steps";
import { AppTourContext, type AppTourContextValue } from "./tour-context";
import { waitForElement } from "./wait-for-element";

/**
 * How long a step waits for its element before it is skipped, in milliseconds.
 */
const STEP_TIMEOUT_MS = 6000;

/**
 * How long the tour waits for an order to show the detail of before it leaves that part out, in
 * milliseconds.
 */
const SAMPLE_ORDER_TIMEOUT_MS = 4000;

/**
 * Width from which the sections show in the top bar, matching the `xl` breakpoint of the layout.
 */
const WIDE_NAVIGATION_QUERY = "(min-width: 80rem)";

/**
 * Key that remembers, per account and browser, that the tour was already shown.
 *
 * @param userId - Identifier of the account.
 * @returns The storage key.
 */
function seenKey(userId: string): string {
  return `motorix-tour-seen:${userId}`;
}

/**
 * Tells whether the tour was already shown to an account in this browser.
 *
 * @param userId - Identifier of the account.
 * @returns True when it was shown, or when storage cannot be read.
 */
function wasSeen(userId: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(userId)) !== null;
  } catch {
    return true;
  }
}

/**
 * Remembers that the tour was shown to an account in this browser.
 *
 * @param userId - Identifier of the account.
 */
function markSeen(userId: string): void {
  try {
    window.localStorage.setItem(seenKey(userId), new Date().toISOString());
  } catch {
    return;
  }
}

/**
 * Gap between the screen edges and a popover placed below the top bar, in pixels.
 */
const EDGE_GAP_PX = 8;

/**
 * Places a popover right below its element and inside the screen. The automatic placement of
 * reactour moves it beside an element near the right edge, which leaves it cut off at the top for
 * the elements of the top bar.
 *
 * @param target - Box of the element with its padding, size of the popover and of the window.
 * @returns The left and top coordinates of the popover.
 */
const belowTarget: Position = (target) => [
  Math.min(Math.max(target.left, EDGE_GAP_PX), target.windowWidth - target.width - EDGE_GAP_PX),
  target.bottom,
];

/**
 * Finds an order to show the detail of, without holding the tour when the API is slow or down.
 *
 * @returns The identifier of the newest order, or null when there is none or it took too long.
 */
function findSampleOrder(): Promise<string | null> {
  const timeout: Promise<null> = new Promise((resolve) => window.setTimeout(() => resolve(null), SAMPLE_ORDER_TIMEOUT_MS));
  const newest: Promise<string | null> = fetchOrders({})
    .then((page) => page.items[0]?.id ?? null)
    .catch(() => null);
  return Promise.race([newest, timeout]);
}

/**
 * Props of {@link TourCard}.
 */
interface TourCardProps {
  /** Title of the step. */
  title: string;
  /** What the step explains. */
  body: string;
}

/**
 * Title and text of one step inside the tour popover.
 *
 * @param props - Title and text.
 * @returns The content.
 */
function TourCard({ title, body }: TourCardProps) {
  return (
    <div className="pr-6">
      <h2 className="font-wide text-base font-semibold text-fg">{title}</h2>
      <p className="mt-1.5 text-sm text-fg-muted">{body}</p>
    </div>
  );
}

/**
 * Props of {@link TourBridge}.
 */
interface TourBridgeProps {
  /** Builds the steps and moves to the first one; resolves false when none could be shown. */
  prepare: () => Promise<boolean>;
  /** Steps of the tour for the signed in account. */
  steps: StepType[];
  /** Content of the app. */
  children: ReactNode;
}

/**
 * Connects the reactour state with the app: it hands reactour the steps, which it only reads from
 * its props when it mounts, opens the tour once its first step is ready, opens it by itself the
 * first time an account lands on the dashboard, and remembers when it was shown.
 *
 * @param props - Preparation of the tour, its steps and content of the app.
 * @returns The provider of the tour controls.
 */
function TourBridge({ prepare, steps, children }: TourBridgeProps) {
  const { isOpen, setIsOpen, setSteps } = useTour();
  const { profile } = useSession();
  const location = useLocation();
  const [preparing, setPreparing] = useState<boolean>(false);
  const autoStarted = useRef<boolean>(false);
  const wasOpen = useRef<boolean>(false);

  useEffect(() => {
    setSteps?.(steps);
  }, [steps, setSteps]);

  const start = useCallback(async (): Promise<void> => {
    setPreparing(true);
    try {
      if (await prepare()) {
        setIsOpen(true);
      }
    } finally {
      setPreparing(false);
    }
  }, [prepare, setIsOpen]);

  useEffect(() => {
    if (wasOpen.current && !isOpen && profile) {
      markSeen(profile.id);
    }
    wasOpen.current = isOpen;
  }, [isOpen, profile]);

  useEffect(() => {
    if (autoStarted.current || !profile || location.pathname !== "/app" || wasSeen(profile.id)) {
      return;
    }
    autoStarted.current = true;
    void start();
  }, [profile, location.pathname, start]);

  const value: AppTourContextValue = useMemo(() => ({ start, active: preparing || isOpen }), [start, preparing, isOpen]);
  return <AppTourContext.Provider value={value}>{children}</AppTourContext.Provider>;
}

/**
 * Guided tour of the whole app, built for the role of the signed in account.
 *
 * Each step belongs to a page: moving to it opens that page and waits until its element is on
 * screen, and a step whose element never shows, such as the detail of an order when there are
 * none, is skipped in the direction the person was going.
 *
 * @param props - Content of the app.
 * @returns The provider.
 */
export function AppTourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, can } = useSession();
  const [definitions, setDefinitions] = useState<TourStepDefinition[]>([]);
  const [current, setCurrent] = useState<number>(0);
  const definitionsRef = useRef<TourStepDefinition[]>([]);
  const currentRef = useRef<number>(0);
  const pathRef = useRef<string>(location.pathname);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  /**
   * Moves to a step, opening its page and waiting for its element, or to the next one that can be
   * shown in the same direction.
   *
   * @param index - Step to move to.
   * @param direction - 1 when going forward, -1 when going back.
   * @param list - Steps of the tour; defaults to the current ones.
   * @returns True when a step was shown.
   */
  const goTo = useCallback(
    async (index: number, direction: 1 | -1, list: TourStepDefinition[] = definitionsRef.current): Promise<boolean> => {
      const request: number = ++requestRef.current;
      for (let target = index; target >= 0 && target < list.length; target += direction) {
        const step: TourStepDefinition = list[target] as TourStepDefinition;
        if (pathRef.current !== step.route) {
          pathRef.current = step.route;
          navigate(step.route);
        }
        const element: Element | null = await waitForElement(step.selector, STEP_TIMEOUT_MS, () => request !== requestRef.current);
        if (request !== requestRef.current) {
          return false;
        }
        if (element) {
          currentRef.current = target;
          setCurrent(target);
          return true;
        }
      }
      return false;
    },
    [navigate],
  );

  /**
   * Builds the steps for the signed in account and moves to the first one.
   *
   * @returns True when the first step is ready.
   */
  const prepare = useCallback(async (): Promise<boolean> => {
    if (!profile) {
      return false;
    }
    const sampleOrderId: string | null = can("repair_orders:read") ? await findSampleOrder() : null;
    const list: TourStepDefinition[] = buildTourSteps({
      firstName: profile.full_name.split(" ")[0] ?? profile.full_name,
      role: profile.role,
      can,
      sections: NAV_ITEMS.filter((item) => !item.permission || can(item.permission)).map((item) => item.label),
      wideNavigation: window.matchMedia(WIDE_NAVIGATION_QUERY).matches,
      sampleOrderId,
    });
    definitionsRef.current = list;
    setDefinitions(list);
    return goTo(0, 1, list);
  }, [profile, can, goTo]);

  const requestStep: Dispatch<SetStateAction<number>> = useCallback(
    (value: SetStateAction<number>) => {
      const target: number = typeof value === "function" ? value(currentRef.current) : value;
      void goTo(target, target >= currentRef.current ? 1 : -1);
    },
    [goTo],
  );

  const steps: StepType[] = useMemo(
    () =>
      definitions.map((step) => ({
        selector: step.selector,
        content: <TourCard title={step.title} body={step.body} />,
        resizeObservables: [step.selector],
        position: step.below ? belowTarget : undefined,
      })),
    [definitions],
  );

  const reducedMotion: boolean = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <TourProvider
      steps={steps}
      currentStep={current}
      setCurrentStep={requestStep}
      disableInteraction
      disableDotsNavigation
      showDots={false}
      scrollSmooth={!reducedMotion}
      onClickMask={() => undefined}
      padding={{ mask: 6, popover: 12 }}
      badgeContent={({ currentStep, totalSteps }) => `${currentStep + 1}/${totalSteps}`}
      accessibilityOptions={{ closeButtonAriaLabel: "Cerrar el recorrido", showNavigationScreenReaders: false }}
      prevButton={({ currentStep, setCurrentStep }) => (
        <Button variant="outline" size="sm" disabled={currentStep === 0} onClick={() => setCurrentStep(currentStep - 1)}>
          Anterior
        </Button>
      )}
      nextButton={({ currentStep, stepsLength, setCurrentStep, setIsOpen }) =>
        currentStep >= stepsLength - 1 ? (
          <Button size="sm" onClick={() => setIsOpen(false)}>
            Terminar
          </Button>
        ) : (
          <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)}>
            Siguiente
          </Button>
        )
      }
      styles={{
        popover: (base) => ({
          ...base,
          backgroundColor: "var(--panel)",
          color: "var(--fg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          boxShadow: "0 24px 48px rgb(0 0 0 / 0.35)",
          padding: "20px 20px 16px",
          maxWidth: 360,
        }),
        maskWrapper: (base) => ({ ...base, color: "#000", opacity: 0.6 }),
        maskArea: (base) => ({ ...base, rx: 8 }),
        badge: (base) => ({
          ...base,
          background: "var(--accent)",
          color: "var(--accent-fg)",
          fontFamily: "inherit",
          fontWeight: 700,
          paddingInline: "0.6em",
          height: "1.9em",
          lineHeight: "1.9em",
        }),
        close: (base) => ({ ...base, color: "var(--fg-subtle)", top: 18, right: 18, width: 11, height: 11 }),
        controls: (base) => ({ ...base, marginTop: 18, gap: 8 }),
      }}
    >
      <TourBridge prepare={prepare} steps={steps}>
        {children}
      </TourBridge>
    </TourProvider>
  );
}
