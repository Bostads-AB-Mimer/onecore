// @vitest-environment jsdom
import axios, { AxiosError, AxiosHeaders } from 'axios'

import { guideService } from './guideService'

const body = {
  fileName: 'a.png',
  fileData: 'AAAA',
  contentType: 'image/png',
}

const axiosRejection = (data: unknown) => {
  const error = new AxiosError('Request failed with status code 400')
  error.response = {
    data,
    status: 400,
    statusText: 'Bad Request',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('guideService.uploadStepImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the uploaded image', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { content: { id: 'img-1' } },
    })
    await expect(
      guideService.uploadStepImage('g1', 's1', body)
    ).resolves.toMatchObject({ id: 'img-1' })
  })

  it('rejects with the { error } body core returned', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(
      axiosRejection({ error: 'invalid-file-type' })
    )
    await expect(
      guideService.uploadStepImage('g1', 's1', body)
    ).rejects.toEqual({ error: 'invalid-file-type' })
  })

  it('rejects with a generic code and the original message when there is no error body', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'))
    await expect(
      guideService.uploadStepImage('g1', 's1', body)
    ).rejects.toEqual({ error: 'upload-failed', detail: 'Network Error' })
  })

  it('keeps a non-Error rejection as the detail', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue('boom')
    await expect(
      guideService.uploadStepImage('g1', 's1', body)
    ).rejects.toEqual({ error: 'upload-failed', detail: 'boom' })
  })
})
