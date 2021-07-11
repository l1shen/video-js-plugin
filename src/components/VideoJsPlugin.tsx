import React, { Component } from "react";
import videojs, { VideoJsPlayer } from "video.js";
import { autorun, CNode, Player, PlayerConsumer, Room, RoomConsumer } from "white-web-sdk";
import { options } from "../options";
import { Props } from "../types";
import { checkWhiteWebSdkVersion, getCurrentTime, nextFrame } from "../utils";
import PlayerController from "./PlayerController";
import "./style.css";
import { FlexTransform } from "./Transform";

export class VideoJsPlugin extends Component<Props> {
    render() {
        const { cnode, size, scale } = this.props;
        return (
            <CNode context={cnode}>
                <FlexTransform size={size} scale={scale}>
                    <RoomConsumer>
                        {room => room && <Impl room={room} {...this.props} />}
                    </RoomConsumer>
                    <PlayerConsumer>
                        {player => player && <Impl player={player} {...this.props} />}
                    </PlayerConsumer>
                </FlexTransform>
            </CNode>
        );
    }
}

interface State {
    NoSound: boolean;
    updater: boolean;
    controllerVisible: boolean;
}

export type PropsWithDisplayer = Props & { room?: Room; player?: Player };

class Impl extends Component<PropsWithDisplayer, State> {
    closeIcon: HTMLSpanElement | null = null;
    alertMask: HTMLDivElement | null = null;
    container = React.createRef<HTMLDivElement>();
    player!: VideoJsPlayer;
    controllerHiddenTimer = 0;
    syncPlayerTimer = 0;

    constructor(props: PropsWithDisplayer) {
        super(props);
        this.state = {
            NoSound: false,
            updater: false,
            controllerVisible: false,
        };

        props.room && checkWhiteWebSdkVersion(props.room);

        (window as any).plugin = this.props.plugin;
    }

    render() {
        const s = this.props.plugin.attributes;
        const duration = (this.player?.duration() || 1e3) * 1000;
        const bufferedPercent = this.player?.bufferedPercent() || 0;
        return (
            <div
                className={
                    this.isEnabled()
                        ? "video-js-plugin-container"
                        : "video-js-plugin-container disabled"
                }
                onMouseEnter={this.showController}
                onMouseMove={this.showController}
            >
                <div className="video-js-plugin-player" ref={this.container}></div>
                <div
                    className="video-js-plugin-header"
                    style={{ opacity: this.state.controllerVisible ? "1" : "0" }}
                >
                    <div className="video-js-plugin-title">HAHAHA</div>
                    <div className="videojs-plugin-close-icon" ref={this.setupClose}>
                        &times;
                    </div>
                </div>
                <PlayerController
                    pause={this.pause}
                    volume={s.volume}
                    handleVolume={this.handleVolume}
                    play={this.play}
                    paused={s.paused}
                    duration={duration}
                    seekTime={this.seekTime}
                    bufferProgress={duration * bufferedPercent}
                    progressTime={getCurrentTime(s, this.props) * 1000}
                    visible={this.state.controllerVisible}
                />
                {!this.props.plugin.context?.hideMuteAlert && this.state.NoSound && (
                    <div ref={this.setupAlert} className="videojs-plugin-muted-alert"></div>
                    )}
            </div>
        );
    }

    showController = () => {
        this.setState({ controllerVisible: true });
        this.setControllerHide();
    };

    play = () => {
        const hostTime = this.props.room?.calibrationTimestamp;
        this.props.plugin.putAttributes({ paused: false, hostTime });
    };

    pause = () => {
        const currentTime = getCurrentTime(this.props.plugin.attributes, this.props);
        this.props.plugin.putAttributes({ paused: true, currentTime });
    };

    handleVolume = (volume: number) => {
        this.props.plugin.putAttributes({ volume });
    };

    seekTime = (t: number) => {
        const hostTime = this.props.room?.calibrationTimestamp;
        this.props.plugin.putAttributes({ currentTime: t / 1000, hostTime });
    };

    resetPlayer = () => {
        this.player.autoplay(false);
        this.props.plugin.putAttributes({ paused: true, currentTime: 0 });
    };

    componentDidMount() {
        this.initPlayer();
        autorun(this.syncPlayerWithAttributes);
        this.syncPlayerTimer = setInterval(this.syncPlayerWithAttributes, options.syncInterval);
    }

    componentWillUnmount() {
        this.player?.dispose();
        clearInterval(this.syncPlayerTimer);
    }

    syncPlayerWithAttributes = () => {
        void this.props.plugin.context;
        const s = this.props.plugin.attributes;

        const player = this.player;
        if (!player) return;

        if (player.paused() !== s.paused) {
            if (s.paused) {
                player.pause();
            } else {
                player.play()?.catch(this.catchPlayFail);
            }
        }

        // NOTE: 2 actions below will cause error message in console (ignore them)
        if (player.muted() !== s.muted) {
            player.muted(s.muted);
        }

        if (player.volume() !== s.volume) {
            player.volume(s.volume);
        }

        const currentTime = getCurrentTime(s, this.props);
        if (Math.abs(player.currentTime() - currentTime) > options.currentTimeMaxError) {
            player.currentTime(currentTime);
        }
    };

    setControllerHide = () => {
        if (this.controllerHiddenTimer) {
            clearTimeout(this.controllerHiddenTimer);
            this.controllerHiddenTimer = 0;
        }
        this.controllerHiddenTimer = setTimeout(() => {
            this.setState({ controllerVisible: false });
            this.controllerHiddenTimer = 0;
        }, 3000);
    };

    catchPlayFail = (err: Error) => {
        if (String(err).includes("interact")) {
            this.player.autoplay("any");
            this.setState({ NoSound: true });
        }
    };

    fixPlayFail = () => {
        this.setState({ NoSound: false });
        const { muted, volume } = this.props.plugin.attributes;
        if (this.player) {
            this.player.muted(muted);
            this.player.volume(volume);
        }
    };

    async initPlayer() {
        this.player?.dispose();

        const { src, poster } = this.props.plugin.attributes;

        const wrapper = document.createElement("div");
        wrapper.setAttribute("data-vjs-player", "");

        const video = document.createElement("video");
        video.className = "video-js";
        video.setAttribute("playsInline", "true");
        video.setAttribute("webkit-playsinline", "true");
        poster && (video.poster = poster);

        const source = document.createElement("source");
        if (new URL(src).pathname.endsWith(".m3u8")) {
            source.type = "application/x-mpegURL";
        } else {
            video.src = src;
        }
        source.src = src;

        video.appendChild(source);
        wrapper.appendChild(video);
        this.container.current!.appendChild(wrapper);

        // NOTE: don't remove this line!
        await nextFrame();

        const player = videojs(video);
        this.player = player;

        player.one("loadedmetadata", () => {
            this.setState({ updater: !this.state.updater });
        });

        player.on("ready", () => {
            options.onPlayer?.(player);
            player.on("timeupdate", () => {
                this.setState({ updater: !this.state.updater });
            });
            player.on("ended", this.resetPlayer);
        });

        (window as any).player = player;
    }

    setupClose = (element: HTMLSpanElement | null) => {
        if (element) {
            element.addEventListener("touchstart", this.removeSelf);
            element.addEventListener("click", this.removeSelf);
        }
        this.closeIcon = element;
    };

    setupAlert = (element: HTMLDivElement | null) => {
        if (element) {
            element.addEventListener("touchstart", this.fixPlayFail);
            element.addEventListener("click", this.fixPlayFail);
        }
        this.alertMask = element;
    };

    removeSelf = () => this.props.plugin.remove();

    isEnabled() {
        if (!this.props.room?.isWritable) return false;

        let { identity, disabled } = this.props.plugin.context || {};
        if (identity === undefined && disabled === undefined) {
            // if not set, default to false
            return false;
        }
        if (identity) {
            // @deprecated respect identity
            return ["host", "publisher"].includes(identity);
        }
        if (disabled === undefined) {
            // if not set, default to false
            return false;
        }
        // not disabled
        return !disabled;
    }
}
