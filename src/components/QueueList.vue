<template>
    <transition name="fade">
        <div v-if="showQueue" class="queue-popup">
            <div class="queue-header">
                <div class="queue-title-row">
                    <h3>
                        <span>{{ $t('bo-fang-lie-biao') }}</span> ({{ musicQueueStore.queue.length }})
                    </h3>
                    <button class="queue-icon-btn danger" @click="clearCurrentQueue" title="清空当前播放列表">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="queue-switch-row">
                    <select class="queue-select" :value="musicQueueStore.activeQueueId" @change="handleQueueSwitch">
                        <option v-for="queue in musicQueueStore.queues" :key="queue.id" :value="queue.id">
                            {{ queue.name }} ({{ queue.songs.length }})
                        </option>
                    </select>
                    <button class="queue-icon-btn" @click="createQueue" title="新建播放列表">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="queue-icon-btn" @click="renameQueue" title="重命名播放列表">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="queue-icon-btn danger" :disabled="musicQueueStore.queues.length <= 1"
                        @click="deleteQueue" title="删除播放列表">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <RecycleScroller :items="musicQueueStore.queue" :item-size="50" key-field="id" :buffer="200"
                :items-limit="2000" :prerender="Math.min(10, musicQueueStore.queue.length)" ref="queueScroller"
                class="queue-list">
                <template #default="{ item, index }">
                    <li class="queue-item" :class="{ 'playing': currentSong.hash == item.hash }" :key="item.id">
                        <div class="queue-song-info">
                            <span class="queue-song-title">{{ item.name }}</span>
                            <span class="queue-artist">{{ $formatMilliseconds(item.timeLength) }}</span>
                        </div>
                        <div class="queue-actions">
                            <button v-if="currentSong.hash == item.hash" class="queue-play-btn fas fa-music"></button>
                            <template v-else>
                                <button class="queue-play-btn" @click="playQueueItem(item)"><i
                                        class="fas fa-play"></i></button>
                                <i class="fas fa-times close-store" @click="removeSongFromQueue(index);"></i>
                            </template>
                        </div>
                    </li>
                </template>
            </RecycleScroller>
        </div>
    </transition>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { RecycleScroller } from 'vue3-virtual-scroller';
import { useMusicQueueStore } from '../stores/musicQueue';
import 'vue3-virtual-scroller/dist/vue3-virtual-scroller.css';

const props = defineProps({
    currentSong: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['update:showQueue', 'addSongToQueue', 'addCloudMusicToQueue', 'addLocalMusicToQueue', 'queue-switched']);

const musicQueueStore = useMusicQueueStore();
const queueScroller = ref(null);
const showQueue = ref(false);

const scrollToCurrentSong = () => {
    const currentIndex = musicQueueStore.queue.findIndex(song => song.hash === props.currentSong.hash);
    if (currentIndex !== -1) {
        queueScroller.value?.scrollToItem(Math.max(0, currentIndex - 3));
    }
};

const handleQueueSwitch = async (event) => {
    const switched = musicQueueStore.switchQueue(event.target.value);
    if (!switched) return;
    emit('queue-switched');
    await nextTick();
    scrollToCurrentSong();
};

const createQueue = async () => {
    const name = await window.$modal.prompt('请输入播放列表名称', `播放列表 ${musicQueueStore.queues.length + 1}`);
    if (!name) return;
    musicQueueStore.createQueue(name);
    emit('queue-switched');
    await nextTick();
    scrollToCurrentSong();
};

const renameQueue = async () => {
    const currentName = musicQueueStore.activeQueueName;
    const name = await window.$modal.prompt('请输入新的播放列表名称', currentName);
    if (!name || name === currentName) return;
    musicQueueStore.renameQueue(musicQueueStore.activeQueueId, name);
};

const deleteQueue = async () => {
    if (musicQueueStore.queues.length <= 1) return;
    const confirmed = await window.$modal.confirm(`确定删除播放列表「${musicQueueStore.activeQueueName}」吗？`);
    if (!confirmed) return;
    musicQueueStore.deleteQueue(musicQueueStore.activeQueueId);
    emit('queue-switched');
    await nextTick();
    scrollToCurrentSong();
};

const clearCurrentQueue = async () => {
    if (musicQueueStore.queue.length === 0) return;
    const confirmed = await window.$modal.confirm(`确定清空「${musicQueueStore.activeQueueName}」吗？`);
    if (!confirmed) return;
    musicQueueStore.clearQueue();
};

// 从队列中删除歌曲
const removeSongFromQueue = (index) => {
    const updatedQueue = [...musicQueueStore.queue];
    updatedQueue.splice(index, 1);
    updatedQueue.forEach((song, i) => {
        song.id = i + 1;
    });
    musicQueueStore.setQueue(updatedQueue);
};

// 播放队列中的歌曲项
const playQueueItem = (item) => {
    console.log('[QueueList] 点击播放队列中的歌曲:', item.name);
    showQueue.value = false; // 点击后关闭播放队列面板
    if (item.isCloud) {
        emit('addCloudMusicToQueue', item.hash, item.name, item.author, item.timeLength, item.img);
    } else if (item.isLocal) {
        emit('addLocalMusicToQueue', item);
    } else {
        emit('addSongToQueue', item.hash, item.name, item.img, item.author);
    }
};

// 滚动到当前播放歌曲位置
const openQueue = async () => {
    showQueue.value = !showQueue.value;
    if (showQueue.value) {
        await nextTick();
        setTimeout(() => {
            scrollToCurrentSong();
        }, 100);
    }
};

const handleClickOutside = (event) => {
    const queuePopup = document.querySelector('.queue-popup');
    if (queuePopup && !queuePopup.contains(event.target) && !event.target.closest('.extra-btn')) {
        showQueue.value = false;
    }
};

onMounted(() => {
    musicQueueStore.initQueues();
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});

defineExpose({
    openQueue,
    removeSongFromQueue
});
</script>
<style lang="scss" scoped>
.queue-popup {
    position: fixed;
    right: 20px;
    bottom: 100px;
    width: 360px;
    max-height: 400px;
    background: #fff;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    padding: 10px;
    z-index: 2;
    overflow-y: auto;
}

.queue-header {
    margin-bottom: 10px;
    position: sticky;
    top: 0px;
    z-index: 1;
    border-radius: 5px;
    padding: 5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    h3 {
        margin: 0;
        font-size: 1.2em;
        color: var(--text-color);
    }
}

.queue-title-row,
.queue-switch-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.queue-title-row {
    justify-content: space-between;
    margin-bottom: 8px;
}

.queue-select {
    flex: 1;
    min-width: 0;
    height: 30px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: #fff;
    color: var(--text-color);
    padding: 0 8px;
}

.queue-icon-btn {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: var(--background-color);
    color: var(--primary-color);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
        background: var(--secondary-color);
        color: #fff;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }

    &.danger {
        color: #ff5f57;
    }
}

.queue-list {
    list-style: none;
    padding: 0;
    margin: 0;
    flex: 1;
    overflow-y: auto;
    height: 350px;
    scroll-behavior: smooth;
}

.queue-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ddd;

    &.playing {
        .queue-song-title {
            color: var(--primary-color);
            font-weight: bold;
        }

        .queue-artist {
            color: var(--primary-color);
        }
    }
}

.queue-song-info {
    display: flex;
    flex-direction: column;
}

.queue-song-title {
    font-weight: bold;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 285px;
}

.queue-artist {
    font-size: 0.9em;
    color: #666;
}

.queue-actions {
    display: flex;
    align-items: center;
}

.queue-play-btn {
    background: none;
    border: none;
    font-size: 16px;
    color: var(--primary-color);
    cursor: pointer;
}

.close-store {
    margin-left: 8px;
    cursor: pointer;
    font-size: 14px;
}
</style>
