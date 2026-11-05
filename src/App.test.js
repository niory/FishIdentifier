import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as tmImage from '@teachablemachine/image';
import FishIdentifier from './components/FishIdentifier';

jest.mock('@teachablemachine/image', () => ({ load: jest.fn() }));
const stop = jest.fn();
const stream = { getTracks: () => [{ stop }] };

beforeEach(() => {
  jest.clearAllMocks();
  tmImage.load.mockResolvedValue({ predict: jest.fn() });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: jest.fn().mockResolvedValue(stream) }
  });
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());

async function ready() {
  render(<FishIdentifier />);
  await screen.findByRole('button', { name: '📁 Выбрать фото' });
}

test('shows model failure and retries successfully', async () => {
  tmImage.load.mockRejectedValueOnce(new Error('offline'));
  render(<FishIdentifier />);
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.queryByText('Загружаем модель…')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
  expect(await screen.findByRole('button', { name: '📁 Выбрать фото' })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('mounts video, attaches stream, waits for frame and stops camera on cancel', async () => {
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '📷 Сделать фото' }));
  const capture = await screen.findByRole('button', { name: '📸 Сделать фото' });
  const video = document.querySelector('video');
  expect(video.srcObject).toBe(stream);
  expect(capture).toBeDisabled();
  fireEvent.loadedData(video);
  expect(capture).toBeEnabled();
  fireEvent.click(screen.getAllByRole('button', { name: '✖ Отмена' })[0]);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(document.querySelector('video')).toBeNull();
});

test('stops late camera stream when request was cancelled', async () => {
  let resolve;
  navigator.mediaDevices.getUserMedia.mockReturnValue(new Promise(r => { resolve = r; }));
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '📷 Сделать фото' }));
  fireEvent.click(screen.getByRole('button', { name: '✖ Отмена' }));
  await act(async () => { resolve(stream); });
  expect(stop).toHaveBeenCalledTimes(1);
  expect(document.querySelector('video')).toBeNull();
});

test('releases camera on unmount', async () => {
  const { unmount } = render(<FishIdentifier />);
  fireEvent.click(await screen.findByRole('button', { name: '📷 Сделать фото' }));
  await screen.findByRole('button', { name: '📸 Сделать фото' });
  unmount();
  expect(stop).toHaveBeenCalledTimes(1);
});

test('explains denied camera permission', async () => {
  navigator.mediaDevices.getUserMedia.mockRejectedValue({ name: 'NotAllowedError' });
  await ready();
  fireEvent.click(screen.getByRole('button', { name: '📷 Сделать фото' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Доступ к камере запрещён');
});

test('rejects oversized images before reading them', async () => {
  await ready();
  const file = new File(['x'], 'large.jpg', { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 });
  fireEvent.change(screen.getByLabelText('Фото рыбы'), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('20 МБ'));
});
