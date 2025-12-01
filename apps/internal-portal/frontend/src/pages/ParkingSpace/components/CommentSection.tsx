import BlockIcon from '@mui/icons-material/Block'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControl,
  IconButton,
  Paper,
  TextareaAutosize,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { LoadingButton } from '@mui/lab'
import { useForm, Controller } from 'react-hook-form'
import { TransitionGroup } from 'react-transition-group'
import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/sv'
import { CommentThreadId, Comment, CommentType } from '@onecore/types'
import { toast } from 'react-toastify'

import { useProfile, Account } from '../../../common/hooks/useProfile'
import { useCommentThread } from '../hooks/useCommentThread'
import { useAddComment } from '../hooks/useAddComment'
import { useRemoveComment } from '../hooks/useRemoveComment'

dayjs.extend(relativeTime)
dayjs.locale('sv')

const commentTypeColors: Record<string, string> = {
  COMMENT: 'inherit',
  WARNING: '#fffdf5',
  STOP: '#fff7f8',
}

const iconProps = { margin: '8px' }

const commentIcons: { [key: string]: JSX.Element } = {
  COMMENT: <ChatBubbleOutlineIcon sx={{ ...iconProps, color: '#2196f3' }} />,
  WARNING: <WarningAmberIcon sx={{ ...iconProps, color: '#fbc02d' }} />,
  STOP: <BlockIcon sx={{ ...iconProps, color: '#e53935' }} />,
}

type CommentFormState = {
  type: CommentType
  comment: string
}

const CommentCard = ({
  comment,
  isOwnComment,
  onDeleteClick,
}: {
  comment: Comment
  isOwnComment: boolean
  onDeleteClick: (id: number) => void
}) => (
  <Paper
    sx={{
      padding: '8px',
      marginTop: '16px',
      backgroundColor: commentTypeColors[comment.type],
    }}
  >
    <Box
      className="invisible-parent"
      display="flex"
      columnGap={1}
      justifyContent="space-between"
      alignItems="flex-start"
    >
      <Box display="flex" columnGap={1} flexGrow={1}>
        {commentIcons[comment.type]}
        <div>
          <Typography variant="body2">
            {dayjs(comment.createdAt).fromNow()}
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold">
            {comment.authorName}
          </Typography>
          <Typography variant="body1">{comment.comment}</Typography>
        </div>
      </Box>
      <div>
        {isOwnComment && (
          <Button
            className="invisible-child"
            variant="dark-outlined-utility"
            size="small"
            color="primary"
            onClick={() => onDeleteClick(comment.id)}
          >
            Ta bort
          </Button>
        )}
      </div>
    </Box>
  </Paper>
)

const CommentSection = (props: { threadId: CommentThreadId }) => {
  const { data: profile } = useProfile()

  const account = profile?.account as Account
  const threadId = props.threadId

  /* State */
  const [comments, setComments] = useState<Array<Comment>>([])
  const [localCommentIds, setLocalCommentIds] = useState<Set<number>>(new Set())
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    commentId?: number
  }>({ open: false })

  const { data } = useCommentThread(threadId)

  useEffect(() => {
    if (data) {
      setComments(data.comments)
    }
  }, [data])

  const { control, handleSubmit, reset } = useForm<CommentFormState>({
    defaultValues: { type: 'COMMENT', comment: '' },
  })

  /* Mutations */
  const addComment = useAddComment()
  const onSubmit = (form: CommentFormState) => {
    addComment.mutate(
      {
        threadId: threadId,
        comment: {
          comment: form.comment,
          type: form.type,
        },
      },
      {
        onSuccess: (newComment: Comment) => {
          setLocalCommentIds((current) => new Set(current).add(newComment.id))
          setComments([newComment, ...comments])
          reset({ type: 'COMMENT', comment: '' })
        },
        onError: () => {
          toast('Ett fel inträffade när din kommentar skulle sparas.', {
            type: 'error',
            hideProgressBar: true,
          })
        },
      }
    )
  }

  const removeComment = useRemoveComment()
  const handleDelete = (id: number): void => {
    removeComment.mutate(
      {
        threadId: threadId,
        commentId: id,
      },
      {
        onSuccess: () => {
          setDeleteDialog({ open: false })
          setComments((comments) => comments.filter((c) => c.id !== id))
        },
      }
    )
  }

  /* Dialog interaction */
  const handleDeleteClick = (id: number): void => {
    setDeleteDialog({
      open: true,
      commentId: id,
    })
  }

  const handleCloseDialog = () => {
    setDeleteDialog({ open: false })
  }

  /* Periodical re-render */
  const [, forceRerender] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      forceRerender((i) => i + 1)
    }, 10 * 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormControl fullWidth>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Typography variant="h2" paddingBottom={1}>
              Notering/kommentar
            </Typography>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <ToggleButtonGroup
                  value={field.value}
                  exclusive
                  onChange={(_, val) => val && field.onChange(val)}
                  aria-label="Typ av kommentar"
                >
                  <ToggleButton
                    value="COMMENT"
                    aria-label="Kommentar"
                    sx={{
                      color: '#2196f3', // light blue
                      '&.Mui-selected': {
                        backgroundColor: '#e3f2fd', // light blue background
                        color: '#0d47a1',
                      },
                    }}
                  >
                    <ChatBubbleOutlineIcon />
                  </ToggleButton>
                  <ToggleButton
                    value="WARNING"
                    aria-label="Varning"
                    sx={{
                      color: '#fbc02d', // amber
                      '&.Mui-selected': {
                        backgroundColor: '#fff8e1', // light yellow bg
                        color: '#f57f17',
                      },
                    }}
                  >
                    <WarningAmberIcon />
                  </ToggleButton>
                  <ToggleButton
                    value="STOP"
                    aria-label="Allvarlig varning"
                    sx={{
                      color: '#e53935', // red
                      '&.Mui-selected': {
                        backgroundColor: '#ffebee', // light red bg
                        color: '#b71c1c',
                      },
                    }}
                  >
                    <BlockIcon />
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            />
          </Box>
          <FormControl fullWidth>
            <Controller
              name="comment"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <TextareaAutosize
                  {...field}
                  minRows={3}
                  placeholder="Skriv din kommentar här..."
                />
              )}
            ></Controller>
          </FormControl>
          <Box display="flex" justifyContent="right">
            <Button type="submit" variant="contained">
              Lägg till kommentar
            </Button>
          </Box>
          <Box marginTop={4}>
            <TransitionGroup>
              {comments.map((comment) => (
                <Collapse in={localCommentIds.has(comment.id)} key={comment.id}>
                  <CommentCard
                    comment={comment}
                    isOwnComment={account?.username === comment.authorId}
                    onDeleteClick={() => handleDeleteClick(comment.id)}
                  />
                </Collapse>
              ))}
            </TransitionGroup>
          </Box>
        </FormControl>
        <Dialog
          open={deleteDialog.open}
          maxWidth="xs"
          TransitionProps={{ exit: false }}
        >
          <Box paddingTop="0.5rem">
            <Box display="flex">
              <DialogTitle>Ta bort kommentar</DialogTitle>
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                marginLeft="auto"
                marginRight="1rem"
              >
                <IconButton onClick={(_) => handleCloseDialog()}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
          </Box>
          <DialogContent>
            <Typography
              textAlign="center"
              paddingTop="1rem"
              paddingBottom="2rem"
            >
              Vill du ta bort denna kommentar?
            </Typography>
            <Box
              display="flex"
              gap="6rem"
              justifyContent="space-between"
              paddingTop="1rem"
            >
              <Button
                variant="dark-outlined"
                onClick={(_) => handleCloseDialog()}
                disabled={removeComment.isPending}
              >
                Avbryt
              </Button>
              <LoadingButton
                variant="dark"
                onClick={() => handleDelete(deleteDialog.commentId!)}
                loading={removeComment.isPending}
              >
                Bekräfta
              </LoadingButton>
            </Box>
          </DialogContent>
        </Dialog>
      </form>
    </>
  )
}

export default CommentSection
