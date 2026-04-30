import { defineStore } from 'pinia';

const DEFAULT_QUEUE_ID = 'default';

const createDefaultQueue = (songs = []) => ({
    id: DEFAULT_QUEUE_ID,
    name: '默认播放列表',
    songs,
    createdAt: Date.now(),
    updatedAt: Date.now(),
});

const normalizeSongs = (songs = []) => (Array.isArray(songs) ? songs : []).map((song, index) => ({
    ...song,
    id: index + 1,
}));

export const useMusicQueueStore = defineStore('MusicQueue', {
    state: () => ({
        queue: [], // 当前播放列表，保留用于兼容现有播放逻辑
        queues: [], // 所有播放列表
        activeQueueId: DEFAULT_QUEUE_ID,
        queueSeq: 1,
    }),
    getters: {
        activeQueue(state) {
            return state.queues.find(queue => queue.id === state.activeQueueId) || null;
        },
        activeQueueName(state) {
            return state.queues.find(queue => queue.id === state.activeQueueId)?.name || '默认播放列表';
        },
    },
    actions: {
        // 初始化/迁移多播放列表数据
        initQueues(options = {}) {
            const { hydrateQueue = true } = options;
            if (!Array.isArray(this.queues) || this.queues.length === 0) {
                this.queue = normalizeSongs(this.queue);
                this.queues = [createDefaultQueue(this.queue)];
                this.activeQueueId = DEFAULT_QUEUE_ID;
                this.queueSeq = 1;
                return;
            }

            if (!this.queues.some(queue => queue.id === this.activeQueueId)) {
                this.activeQueueId = this.queues[0]?.id || DEFAULT_QUEUE_ID;
            }

            const activeQueue = this.queues.find(queue => queue.id === this.activeQueueId);
            if (hydrateQueue && activeQueue) {
                activeQueue.songs = normalizeSongs(this.queue.length ? this.queue : activeQueue.songs);
                this.queue = normalizeSongs(activeQueue.songs);
            }

            const maxSeq = this.queues.reduce((max, queue) => {
                const match = String(queue.id).match(/^queue_(\d+)$/);
                return match ? Math.max(max, Number(match[1])) : max;
            }, 0);
            this.queueSeq = Math.max(this.queueSeq || 1, maxSeq + 1);
        },
        // 将当前兼容 queue 同步回激活播放列表
        syncActiveQueue() {
            this.initQueues({ hydrateQueue: false });
            const activeQueue = this.queues.find(queue => queue.id === this.activeQueueId);
            if (!activeQueue) return;
            activeQueue.songs = normalizeSongs(this.queue);
            activeQueue.updatedAt = Date.now();
        },
        // 切换当前播放列表。只切换后续队列，不主动打断当前播放。
        switchQueue(queueId) {
            this.syncActiveQueue();
            const targetQueue = this.queues.find(queue => queue.id === queueId);
            if (!targetQueue) return false;
            this.activeQueueId = targetQueue.id;
            this.queue = normalizeSongs(targetQueue.songs);
            return true;
        },
        createQueue(name = '') {
            this.syncActiveQueue();
            const nextId = `queue_${this.queueSeq || 1}`;
            this.queueSeq = (this.queueSeq || 1) + 1;
            const trimmedName = String(name || '').trim();
            const queue = {
                id: nextId,
                name: trimmedName || `播放列表 ${this.queues.length + 1}`,
                songs: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            this.queues.push(queue);
            this.switchQueue(queue.id);
            return queue;
        },
        renameQueue(queueId, name) {
            const queue = this.queues.find(item => item.id === queueId);
            const trimmedName = String(name || '').trim();
            if (!queue || !trimmedName) return false;
            queue.name = trimmedName;
            queue.updatedAt = Date.now();
            return true;
        },
        deleteQueue(queueId) {
            this.syncActiveQueue();
            if (this.queues.length <= 1) return false;
            const queueIndex = this.queues.findIndex(queue => queue.id === queueId);
            if (queueIndex === -1) return false;

            const deletingActiveQueue = this.activeQueueId === queueId;
            this.queues.splice(queueIndex, 1);

            if (deletingActiveQueue) {
                const nextQueue = this.queues[Math.max(0, queueIndex - 1)] || this.queues[0];
                this.activeQueueId = nextQueue.id;
                this.queue = normalizeSongs(nextQueue.songs);
            }

            return true;
        },
        // 添加歌曲到播放队列
        addSong(song) {
            this.queue.push(song);
            this.syncActiveQueue();
        },
        // 设置整个队列
        setQueue(newQueue) {
            this.queue = normalizeSongs(newQueue);
            this.syncActiveQueue();
        },
        // 获取播放队列
        getQueue() {
            return this.queue;
        },
        // 清空指定歌曲
        removeSong(index) {
            this.queue.splice(index, 1);
            this.setQueue(this.queue);
        },
        // 清空播放队列
        clearQueue() {
            this.queue = [];
            this.syncActiveQueue();
        },
    },
    persist: {
        enabled: true,
        strategies: [
            {
                key: 'MusicQueue',
                storage: localStorage,
                paths: ['queue', 'queues', 'activeQueueId', 'queueSeq'],
            },
        ],
    },
});
