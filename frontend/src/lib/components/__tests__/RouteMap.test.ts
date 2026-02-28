import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RouteMap from '../RouteMap.svelte';
import {
  streamsLatLngFixture,
  streamsPositionFixture,
  streamsNoLocationFixture,
  emptyStreamsFixture,
} from '../../../test/fixtures/streams';

vi.mock('svelte-maplibre-gl', () => import('./route-map-maplibre-stubs'));

describe('RouteMap', () => {
  describe('no route data', () => {
    it('renders nothing when streams is empty and routes is undefined', () => {
      render(RouteMap, { props: { streams: emptyStreamsFixture } });
      expect(screen.queryByTestId('maplibre-stub')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('renders nothing when streams and routes yield no valid route', () => {
      render(RouteMap, { props: { streams: streamsNoLocationFixture } });
      expect(screen.queryByTestId('maplibre-stub')).not.toBeInTheDocument();
    });
  });

  describe('single route (streams prop)', () => {
    it('renders map container and theme selector when route is built from streams', () => {
      render(RouteMap, { props: { streams: streamsLatLngFixture } });
      expect(screen.getByTestId('maplibre-stub')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByTitle('Hide labels')).toBeInTheDocument();
    });

    it('renders map when using Position stream fixture', () => {
      render(RouteMap, { props: { streams: streamsPositionFixture } });
      expect(screen.getByTestId('maplibre-stub')).toBeInTheDocument();
    });

    it('theme selector has expected options and defaults to Liberty', () => {
      render(RouteMap, { props: { streams: streamsLatLngFixture } });
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('liberty');
      expect(screen.getByRole('option', { name: 'Dark' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Positron' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Bright' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Liberty' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Fiord' })).toBeInTheDocument();
    });

    it('toggle labels button is present with appropriate title', () => {
      render(RouteMap, { props: { streams: streamsLatLngFixture } });
      const labelsBtn = screen.getByTitle('Hide labels');
      expect(labelsBtn).toBeInTheDocument();
      expect(labelsBtn).toHaveAttribute('title', 'Hide labels');
    });

    it('legend is not shown when using single-route mode (no routes prop)', () => {
      render(RouteMap, { props: { streams: streamsLatLngFixture } });
      // Legend shows route labels; in single-route mode labels are empty, but the legend div
      // is only rendered when showLegend is true (routes?.length && routesWithData.length > 0).
      // So with only streams prop, routes is undefined, showLegend is false - no legend section.
      const legendColorSpans = screen.queryAllByText(/:$/);
      expect(legendColorSpans.length).toBe(0);
    });
  });

  describe('multi-route (routes prop)', () => {
    it('when routes is provided with valid data, legend is shown with each route label', () => {
      render(RouteMap, {
        props: {
          routes: [
            { label: 'Morning', color: '#ef4444', streams: streamsLatLngFixture },
            { label: 'Evening', color: '#3b82f6', streams: streamsPositionFixture },
          ],
        },
      });
      expect(screen.getByTestId('maplibre-stub')).toBeInTheDocument();
      expect(screen.getByText('Morning:')).toBeInTheDocument();
      expect(screen.getByText('Evening:')).toBeInTheDocument();
    });

    it('each route label appears in the legend', () => {
      render(RouteMap, {
        props: {
          routes: [
            { label: 'Route A', color: '#22c55e', streams: streamsLatLngFixture },
            { label: 'Route B', color: '#eab308', streams: streamsPositionFixture },
          ],
        },
      });
      expect(screen.getByText('Route A:')).toBeInTheDocument();
      expect(screen.getByText('Route B:')).toBeInTheDocument();
    });
  });
});
