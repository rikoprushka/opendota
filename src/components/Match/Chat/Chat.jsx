import React from 'react';
import { Link } from 'react-router-dom';
import { isRadiant, formatSeconds } from 'utility';
import strings from 'lang';
import { IconRadiant, IconDire } from 'components/Icons';
import Heading from 'components/Heading';
import AvVolumeUp from 'material-ui/svg-icons/av/volume-up';
import Toggle from 'material-ui/Toggle';
import heroes from 'dotaconstants/build/heroes.json';
import playerColors from 'dotaconstants/build/player_colors.json';
import styles from './Chat.css';

// All chat
// https://github.com/dotabuff/d2vpkr/blob/8fdc29b84f3e7e2c130fc1b8c6ffe3b811e2d4a7/dota/scripts/chat_wheel.txt#L640
const chatwheelAll = [75, 76, 108, 109, 110];

class Chat extends React.Component {
  constructor(props) {
    super(props);

    this.raw = this.props.data;

    // detect spam
    for (let i = 0; i < this.raw.length - 1; i += 1) {
      const curr = this.raw[i];
      const next = this.raw[i + 1];
      if (curr.player_slot === next.player_slot) {
        // time diff = 10 sec, I think there is no reason for less or more
        if ((next.time - curr.time) < 10) {
          if (curr.key === next.key) {
            next.spam = true;
          }
        }
        // ex: 3334005345
        if (curr.type === 'chat' && next.type === 'chat') {
          // for some reason some strings have trailing space
          curr.key = curr.key.trim();
          next.key = next.key.trim();
          // if first and last 2 chars matches, it's spam
          if (curr.key.slice(0, 2) === next.key.slice(0, 2) && curr.key.slice(-2) === next.key.slice(-2)) {
            next.spam = true;
          }
        }
      }
    }

    this.state = {
      radiant: true,
      dire: true,
      chat: true,
      chatwheel: true,
      spam: false,

      playing: null,
    };

    this.filters = {
      radiant: (arr = this.raw) => arr.filter(msg => isRadiant(msg.player_slot)),
      dire: (arr = this.raw) => arr.filter(msg => !isRadiant(msg.player_slot)),
      chat: (arr = this.raw) => arr.filter(msg => msg.type === 'chat'),
      chatwheel: (arr = this.raw) => arr.filter(msg => msg.type === 'chatwheel'),
      spam: (arr = this.raw) => arr.filter(msg => msg.spam),
    };

    this.filter = this.filter.bind(this);
    this.audio = this.audio.bind(this);
  }

  filter(key) {
    if (key !== undefined) {
      this.state[key] = !this.state[key];
      this.forceUpdate();
    }

    this.messages = this.raw.slice();

    Object.keys(this.filters).forEach((k) => {
      if (!this.state[k]) {
        this.filters[k]().forEach((obj) => {
          const index = this.messages.indexOf(obj);
          if (index >= 0) {
            this.messages.splice(index, 1);
          }
        });
      }
    });

    // sort by time, considering spam
    this.messages.sort((a, b) => {
      const timeDiff = Number(a.time) - Number(b.time);
      if (timeDiff === 0) {
        if (a.spam === b.spam) {
          return 0;
        }
        return a.spam ? 1 : -1;
      }
      return timeDiff;
    });
  }

  audio(key, index) {
    const a = new Audio(`/assets/chatwheel/dota_chatwheel_${key}.wav`);
    a.play();
    this.setState({
      playing: index,
    });
    const i = setInterval(() => {
      if (a.paused) {
        this.setState({
          playing: null,
        });
        clearInterval(i);
      }
    }, 500);
  }

  render() {
    if (!this.messages) {
      this.filter();
    }

    const Messages = () => (
      <ul className={styles.Chat}>
        {this.messages.map((msg, index) => {
          const hero = heroes[msg.heroID];
          const rad = isRadiant(msg.player_slot);

          let message = msg.key;
          if (msg.type === 'chatwheel') {
            message = [
              strings[`chatwheel_${msg.key}`],
            ];
            if (Number(msg.key) >= 86) {
              message.unshift(<AvVolumeUp
                key={msg.key}
                viewBox="-2 -2 28 28"
                onClick={() => this.audio(msg.key, index)}
                className={`${styles.play} ${this.state.playing === index ? styles.playing : ''}`}
              />);
            } else {
              message.unshift(<img
                key={msg.key}
                src="/assets/images/dota2/chat_wheel_icon.png"
                alt="chatwheel"
                className={styles.chatwheel}
              />);
            }
          }

          let target = strings.chat_all;
          if (msg.type === 'chatwheel' && !chatwheelAll.includes(Number(msg.key))) {
            target = strings.chat_allies;
          }

          return (
            <li
              id={index}
              key={index}
              className={`
                ${rad ? styles.radiant : styles.dire}
                ${msg.spam ? styles.spam : ''}
              `}
            >
              {rad ? <IconRadiant className={styles.icon} /> : <IconDire className={styles.icon} />}
              <time>
                <a href={`#${index}`}>{formatSeconds(msg.time)}</a>
              </time>
              <img
                src={hero ? API_HOST + hero.img : '/assets/images/blank-1x1.gif'}
                alt={hero && hero.localized_name}
              />
              <span className={styles.target}>
                [{target.toUpperCase()}]
              </span>
              <Link
                to={`/players/${msg.accountID}`}
                style={{ color: playerColors[msg.player_slot] }}
                className={`${styles.author} ${msg.accountID ? '' : styles.disabled}`}
              >
                {msg.name}
              </Link>
              <article>
                {message}
              </article>
            </li>
          );
        })}
      </ul>
    );

    const Filters = () => (
      <ul className={styles.Filters}>
        <Heading
          className={styles.heading}
          title="Filters"
        />
        {Object.keys(this.filters).map((key, index) => {
          const len = this.filters[key]().length;
          const switcher = [
            <li key={key}>
              <b>{len}</b>
              <Toggle
                label={strings[`chat_${key}`] || strings[`general_${key}`]}
                toggled={this.state[key]}
                onToggle={() => this.filter(key)}
                thumbStyle={{ backgroundColor: styles.lightGray }}
              />
            </li>,
          ];

          // add dividers for better perception after each 2nd elem
          // divide radiant & dire from chat & chatwheel & spam
          if (index % 2) {
            switcher.push(<hr className={styles.divider} />);
          }

          return len > 0 && switcher;
        })}
      </ul>
    );

    return (
      <div className={styles.Container}>
        <Messages />
        <Filters />
      </div>
    );
  }
}

export default Chat;
