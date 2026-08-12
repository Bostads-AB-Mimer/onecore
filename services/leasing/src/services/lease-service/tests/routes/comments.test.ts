import request from 'supertest'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { Comment } from '@onecore/types'

import { routes } from '../../routes/comments'
import commentAdapter from '../../adapters/comment-adapter'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

beforeEach(jest.restoreAllMocks)

const buildComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 45,
  type: 'COMMENT',
  authorName: 'Test Author',
  authorId: 'test-user',
  comment: 'Updated text',
  createdAt: new Date('2026-07-01T10:00:00Z'),
  updatedAt: new Date('2026-07-27T10:00:00Z'),
  ...overrides,
})

describe('comments routes', () => {
  describe('PUT /comments/:targetType/thread/:targetId/:commentId', () => {
    it('responds with 200 and the updated comment on success', async () => {
      const updated = buildComment({ type: 'WARNING' })
      const spy = jest
        .spyOn(commentAdapter, 'updateComment')
        .mockResolvedValueOnce(updated)

      const res = await request(app.callback())
        .put('/comments/parkingspace/thread/123/45')
        .send({ type: 'WARNING', comment: 'Updated text' })

      expect(res.status).toBe(200)
      expect(res.body.content.id).toBe(updated.id)
      expect(res.body.content.type).toBe('WARNING')
      expect(spy).toHaveBeenCalledWith(
        { targetType: 'parkingspace', targetId: 123 },
        45,
        { type: 'WARNING', comment: 'Updated text' }
      )
    })

    it('responds with 404 when no comment matched the thread', async () => {
      jest
        .spyOn(commentAdapter, 'updateComment')
        .mockResolvedValueOnce(undefined)

      const res = await request(app.callback())
        .put('/comments/parkingspace/thread/123/999')
        .send({ type: 'COMMENT', comment: 'Whatever' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('not-found')
    })

    it('responds with 400 for an invalid comment type', async () => {
      const spy = jest.spyOn(commentAdapter, 'updateComment')

      const res = await request(app.callback())
        .put('/comments/parkingspace/thread/123/45')
        .send({ type: 'NOT_A_TYPE', comment: 'Updated text' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
      expect(spy).not.toHaveBeenCalled()
    })

    it('responds with 400 when the comment text is missing', async () => {
      const spy = jest.spyOn(commentAdapter, 'updateComment')

      const res = await request(app.callback())
        .put('/comments/parkingspace/thread/123/45')
        .send({ type: 'COMMENT' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request body')
      expect(spy).not.toHaveBeenCalled()
    })
  })
})
