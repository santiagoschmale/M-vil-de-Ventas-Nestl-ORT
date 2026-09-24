import React from 'react';
import { render, screen } from '@testing-library/react';
import selectEvent from 'react-select-event';
import { MultiSelect } from './Multiselect';

describe('Profile Test', () => {
  it('select one values', async () => {
    render(
      <form data-testid="form">
        <MultiSelect
          name="select"
          label="select"
          required
          options={[
            { value: 'opt_1', label: 'OPT 1' },
            { value: 'opt_2', label: 'OPT 2' },
            { value: 'opt_3', label: 'OPT 3' },
          ]}
        />
      </form>,
    );

    await selectEvent.select(screen.getByLabelText('select'), ['OPT 2']);
    expect(screen.getByTestId('form')).toHaveFormValues({ select: 'opt_2' });
  });

  it('add a second value', async () => {
    render(
      <form data-testid="form">
        <MultiSelect
          name="select"
          label="select"
          required
          options={[
            { value: 'opt_1', label: 'OPT 1' },
            { value: 'opt_2', label: 'OPT 2' },
            { value: 'opt_3', label: 'OPT 3' },
          ]}
        />
      </form>,
    );

    const select = screen.getByLabelText('select');
    await selectEvent.select(select, ['OPT 2']);
    expect(screen.getByTestId('form')).toHaveFormValues({ select: 'opt_2' });

    await selectEvent.select(select, ['OPT 3']);
    expect(screen.getByTestId('form')).toHaveFormValues({ select: 'opt_2,opt_3' });
  });

  it('select two values', async () => {
    render(
      <form data-testid="form">
        <MultiSelect
          name="select"
          label="select"
          required
          options={[
            { value: 'opt_1', label: 'OPT 1' },
            { value: 'opt_2', label: 'OPT 2' },
            { value: 'opt_3', label: 'OPT 3' },
          ]}
        />
      </form>,
    );

    await selectEvent.select(screen.getByLabelText('select'), ['OPT 1', 'OPT 3']);
    expect(screen.getByTestId('form')).toHaveFormValues({ select: 'opt_1,opt_3' });
  });

  it('empty select', async () => {
    render(
      <form data-testid="form">
        <MultiSelect
          name="select"
          label="select"
          required
          options={[
            { value: 'opt_1', label: 'OPT 1' },
            { value: 'opt_2', label: 'OPT 2' },
            { value: 'opt_3', label: 'OPT 3' },
          ]}
        />
      </form>,
    );

    expect(screen.getByTestId('form')).toHaveFormValues({ select: '' });
  });

  it('with inicial value', async () => {
    render(
      <form data-testid="form">
        <MultiSelect
          name="select"
          label="select"
          values={['opt_1', 'opt_3']}
          required
          options={[
            { value: 'opt_1', label: 'OPT 1' },
            { value: 'opt_2', label: 'OPT 2' },
            { value: 'opt_3', label: 'OPT 3' },
          ]}
        />
      </form>,
    );

    expect(screen.getByTestId('form')).toHaveFormValues({ select: 'opt_1,opt_3' });
  });
});
