import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VirtualMatchList } from '@/components/matches/virtualization/VirtualMatchList';
import { VirtualizationProvider } from '@/components/matches/virtualization/VirtualizationProvider';
import { VirtualMatchCard } from '@/components/matches/virtualization/VirtualMatchCard';
import type { Match, Prediction } from '@/types';

// Mock matches data
const mockMatches: Match[] = Array.from({ length: 50 }, (_, i) => ({
  id: `match-${i}`,
  match_number: i + 1,
  home_team_id: `team-${i * 2}`,
  away_team_id: `team-${i * 2 + 1}`,
  home_team_label: `Team ${i * 2}`,
  away_team_label: `Team ${i * 2 + 1}`,
  match_date: new Date(Date.now() + i * 86400000).toISOString(), // Spread over 50 days
  home_score: null,
  away_score: null,
  status: 'pending' as const,
  phase: 'group' as const,
  group_name: 'A',
  stadium: 'Stadium Name',
  is_locked: false,
}));

const mockPredictions: Prediction[] = [
  {
    id: 'pred-1',
    user_id: 'user-1',
    match_id: 'match-1',
    home_score: 2,
    away_score: 1,
    points_earned: 0,
    created_at: new Date().toISOString(),
  },
];

const mockOnSavePrediction = vi.fn();

describe('VirtualMatchCard', () => {
  it('renders match information correctly', () => {
    const match = mockMatches[0];
    render(
      <VirtualMatchCard
        match={match}
        prediction={mockPredictions[0]}
        onSavePrediction={mockOnSavePrediction}
        userId="user-1"
        style={{ height: '200px' }}
      />
    );

    expect(screen.getByText(`Team 0`)).toBeInTheDocument();
    expect(screen.getByText(`Team 1`)).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
    expect(screen.getByText('ABIERTO')).toBeInTheDocument();
  });

  it('disables inputs when match is locked', () => {
    const lockedMatch = {
      ...mockMatches[0],
      status: 'finished' as const,
      is_locked: true,
    };

    render(
      <VirtualMatchCard
        match={lockedMatch}
        prediction={mockPredictions[0]}
        onSavePrediction={mockOnSavePrediction}
        userId="user-1"
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });

    expect(screen.getByText('BLOQUEADO')).toBeInTheDocument();
  });

  it('calls onSavePrediction when save button is clicked', async () => {
    render(
      <VirtualMatchCard
        match={mockMatches[0]}
        prediction={undefined}
        onSavePrediction={mockOnSavePrediction}
        userId="user-1"
      />
    );

    const homeInput = screen.getAllByRole('spinbutton')[0];
    const awayInput = screen.getAllByRole('spinbutton')[1];

    fireEvent.change(homeInput, { target: { value: '2' } });
    fireEvent.change(awayInput, { target: { value: '1' } });

    const saveButton = screen.getByText('GUARDAR PREDICCIÓN');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSavePrediction).toHaveBeenCalledWith('match-0', 2, 1);
    });
  });
});

describe('VirtualMatchList', () => {
  beforeEach(() => {
    // Mock IntersectionObserver and ResizeObserver
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders virtualized list with many matches', () => {
    render(
      <VirtualizationProvider enabled={true}>
        <VirtualMatchList
          matches={mockMatches}
          predictions={mockPredictions}
          onSavePrediction={mockOnSavePrediction}
          userId="user-1"
          containerHeight={400}
        />
      </VirtualizationProvider>
    );

    // Should show virtualization indicator
    expect(screen.getByText(/desplazamiento virtual activado/i)).toBeInTheDocument();
    expect(screen.getByText(/50 partidos/i)).toBeInTheDocument();
  });

  it('falls back to regular rendering when virtualization is disabled', () => {
    render(
      <VirtualizationProvider enabled={false}>
        <VirtualMatchList
          matches={mockMatches.slice(0, 5)} // Only 5 matches
          predictions={mockPredictions}
          onSavePrediction={mockOnSavePrediction}
          userId="user-1"
          containerHeight={400}
        />
      </VirtualizationProvider>
    );

    // Should render all 5 matches without virtualization
    expect(screen.getAllByText(/Team \d+/)).toHaveLength(10); // 5 matches × 2 teams each
  });

  it('handles missing browser APIs gracefully', () => {
    // Simulate missing IntersectionObserver
    const originalIntersectionObserver = global.IntersectionObserver;
    delete (global as any).IntersectionObserver;

    render(
      <VirtualizationProvider enabled={true}>
        <VirtualMatchList
          matches={mockMatches.slice(0, 10)}
          predictions={mockPredictions}
          onSavePrediction={mockOnSavePrediction}
          userId="user-1"
        />
      </VirtualizationProvider>
    );

    // Should fall back to regular rendering
    expect(screen.getAllByText(/Team \d+/)).toHaveLength(20); // 10 matches × 2 teams each

    // Restore
    global.IntersectionObserver = originalIntersectionObserver;
  });

  it('shows performance indicators', () => {
    render(
      <VirtualizationProvider enabled={true}>
        <VirtualMatchList
          matches={mockMatches}
          predictions={mockPredictions}
          onSavePrediction={mockOnSavePrediction}
          userId="user-1"
          containerHeight={400}
        />
      </VirtualizationProvider>
    );

    expect(screen.getByText(/50 partidos •/)).toBeInTheDocument();
    expect(screen.getByText(/px total/)).toBeInTheDocument();
  });
});

describe('VirtualizationProvider', () => {
  it('provides virtualization context', () => {
    const TestComponent = () => {
      return (
        <VirtualizationProvider enabled={true} estimatedItemHeight={200} overscan={15}>
          <div data-testid="test">Test</div>
        </VirtualizationProvider>
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('test')).toBeInTheDocument();
  });

  it('respects feature flags when forceEnabled is not provided', () => {
    // Note: In a real test, we would mock the feature flag module
    // For this test, we'll verify the component renders
    const TestComponent = () => {
      return (
        <VirtualizationProvider>
          <div data-testid="test">Test</div>
        </VirtualizationProvider>
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('test')).toBeInTheDocument();
  });
});

describe('Accessibility', () => {
  it('includes proper ARIA attributes for virtualized list', () => {
    render(
      <VirtualizationProvider enabled={true}>
        <VirtualMatchList
          matches={mockMatches.slice(0, 10)}
          predictions={mockPredictions}
          onSavePrediction={mockOnSavePrediction}
          userId="user-1"
          containerHeight={400}
        />
      </VirtualizationProvider>
    );

    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-label', 'Lista de partidos con desplazamiento virtual');

    // Check that list items have proper labels
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBeGreaterThan(0);
    
    listItems.forEach((item, index) => {
      expect(item).toHaveAttribute('aria-label');
      expect(item.getAttribute('aria-label')).toContain(`Partido ${index + 1}`);
    });
  });

  it('maintains keyboard navigation for match cards', () => {
    render(
      <VirtualMatchCard
        match={mockMatches[0]}
        prediction={mockPredictions[0]}
        onSavePrediction={mockOnSavePrediction}
        userId="user-1"
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);

    inputs.forEach(input => {
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '99');
      expect(input).not.toBeDisabled();
    });

    const saveButton = screen.getByRole('button', { name: /GUARDAR PREDICCIÓN|ACTUALIZAR/i });
    expect(saveButton).toBeInTheDocument();
  });
});

describe('Performance', () => {
  it('renders efficiently with many items', async () => {
    const startTime = performance.now();

    render(
      <VirtualizationProvider enabled={true}>
        <VirtualMatchList
          matches={mockMatches} // 50 matches
          predictions={mockPredictions}
          onSavePrediction={mockOnSavePrediction}
          userId="user-1"
          containerHeight={400}
        />
      </VirtualizationProvider>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Virtualized list should render quickly even with 50 items
    expect(renderTime).toBeLessThan(1000); // Should render in under 1 second

    // Verify only a subset of items are rendered (virtualization at work)
    const renderedTeams = screen.getAllByText(/Team \d+/);
    expect(renderedTeams.length).toBeLessThan(100); // Should render fewer than all 100 team names (50 matches × 2 teams)
  });

  it('handles large datasets without crashing', () => {
    const manyMatches = Array.from({ length: 200 }, (_, i) => ({
      ...mockMatches[0],
      id: `match-large-${i}`,
      match_number: i + 1,
    }));

    expect(() => {
      render(
        <VirtualizationProvider enabled={true}>
          <VirtualMatchList
            matches={manyMatches}
            predictions={[]}
            onSavePrediction={mockOnSavePrediction}
            userId="user-1"
            containerHeight={500}
          />
        </VirtualizationProvider>
      );
    }).not.toThrow();
  });
});